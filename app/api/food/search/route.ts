import { NextResponse } from "next/server";
import { logProviderEvent } from "../../../lib/observability";
import { regionalScore } from "../../../lib/food-ranking";
import { clientKey, fetchWithTimeout, rateLimitSafe, cacheGet, cacheSet, cachedToken, saveCachedToken, requestId, jsonHeaders, validateSameOrigin, validateJsonBodySize, assertProductionInfrastructure } from "../../../lib/server-safety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FoodResult = {
  name: string; brand?: string; barcode?: string; source: string; referenceId?: string;
  calories100g: number; protein100g: number; carbs100g: number; fat100g: number; fiber100g?: number;
  confidence: number; note?: string; relevance?: number;
};

const n = (v: unknown) => {
  if (typeof v === "string") v = v.replace(/,/g, ".");
  const x = Number(v);
  return Number.isFinite(x) && x >= 0 ? x : 0;
};
const cleanBarcode = (s: string) => s.replace(/\D/g, "");
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, " ").replace(/\s+/g, " ").trim();
const tokens = (s: string) => norm(s).split(" ").filter(x => x.length > 1);
const ARABIC_ALIASES: Record<string,string> = {
  "فراخ":"chicken","دجاج":"chicken","رز":"rice","مكرونة":"pasta","مكرونه":"pasta","بيض":"egg",
  "لحمة":"beef","لحمه":"beef","لحم":"beef","زبادي":"yogurt","لبن":"milk","جبنة":"cheese","جبنه":"cheese",
  "شوفان":"oats","فول":"foul","حمص":"hummus","طعمية":"falafel","طعميه":"falafel","عيش":"bread",
  "بطاطس":"potato","سمك":"fish","تونة":"tuna","تونه":"tuna","موز":"banana","تفاح":"apple"
};
const expandQuery = (s: string) => norm(s).split(" ").map(x => ARABIC_ALIASES[x] || x).join(" ");

const CURATED: FoodResult[] = [
  ["Chicken Mandi",195,14.5,14,8.2,.72],["Mandi rice",150,2.7,27.5,3.3,.70],["Cooked basmati rice",130,2.7,28.2,.3,.76],
  ["Chicken shawarma",215,20,5,13,.68],["Chicken kabsa",190,15,13,8,.70],["Hummus",166,7.9,14.3,9.6,.78],
  ["Foul medames",110,7.6,19.7,.4,.76],["Falafel",333,13.3,31.8,17.8,.76],["Dates",282,2.5,75,.4,.85],
  ["Arabic pita bread",275,9.1,55.7,1.2,.80]
].map(([name,calories100g,protein100g,carbs100g,fat100g,confidence]) => ({
  name: String(name), calories100g:Number(calories100g), protein100g:Number(protein100g), carbs100g:Number(carbs100g), fat100g:Number(fat100g),
  source:"Health OS curated", confidence:Number(confidence), note:"Reference estimate · per 100g"
}));

function relevance(query: string, name: string, brand = "") {
  const q = tokens(query), hay = norm(`${name} ${brand}`);
  if (!q.length) return 0;
  const hits = q.filter(x => hay.includes(x));
  if (!hits.length) return 0;
  let score = hits.length / q.length * 70;
  if (norm(name) === norm(query)) score += 100;
  if (hay.startsWith(norm(query))) score += 25;
  if (hits.length === q.length) score += 25;
  return score;
}

function nutrientsFromUSDA(food: any) {
  const ns = Array.isArray(food?.foodNutrients) ? food.foodNutrients : [];
  const find = (ids: number[]) => n(ns.find((x: any) => ids.includes(Number(x.nutrientId)))?.value);
  return { calories100g:find([1008]), protein100g:find([1003]), carbs100g:find([1005]), fat100g:find([1004]), fiber100g:find([1079]) };
}

async function searchUSDA(query: string): Promise<FoodResult[]> {
  const key = process.env.USDA_FDC_API_KEY;
  if (!key) return [];
  try {
    const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
    url.searchParams.set("api_key", key); url.searchParams.set("query", expandQuery(query)); url.searchParams.set("pageSize", "20");
    url.searchParams.set("dataType", "Foundation,SR Legacy,Survey (FNDDS),Branded");
    const r = await fetchWithTimeout(url, { cache:"no-store", headers:{"User-Agent":"HealthOS personal nutrition app"} });
    if (!r.ok) return [];
    const data = await r.json();
    return (data.foods || []).map((f:any) => ({
      name:f.description || query, brand:f.brandName || f.brandOwner || undefined, source:"USDA", referenceId:String(f.fdcId),
      ...nutrientsFromUSDA(f), confidence:f.dataType === "Foundation" ? .94 : .86,
      note:`${f.dataType || "USDA"} · per 100g`, relevance:relevance(query,f.description || "",f.brandName || f.brandOwner || "")
    })).filter((x:FoodResult)=>(x.relevance || 0) >= (tokens(query).length > 1 ? 45 : 15) && (x.calories100g || x.protein100g || x.carbs100g));
  } catch { return []; }
}

async function searchOFF(query: string, cc: "sa"|"eg"): Promise<FoodResult[]> {
  try {
    const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
    url.searchParams.set("search_terms", expandQuery(query)); url.searchParams.set("search_simple","1"); url.searchParams.set("action","process");
    url.searchParams.set("json","1"); url.searchParams.set("page_size","30"); url.searchParams.set("cc",cc); url.searchParams.set("lc","ar");
    url.searchParams.set("countries_tags_en",cc === "sa" ? "Saudi Arabia" : "Egypt");
    url.searchParams.set("fields","code,product_name,product_name_ar,brands,nutriments,completeness,countries_tags");
    const r = await fetchWithTimeout(url,{cache:"no-store",headers:{"User-Agent":"HealthOS personal nutrition app"}});
    if (!r.ok) return [];
    const data = await r.json();
    return (data.products || []).map((p:any) => {
      const name = p.product_name_ar || p.product_name || query;
      const countries = Array.isArray(p.countries_tags) ? p.countries_tags.join(" ") : "";
      const regional = new RegExp(cc === "sa" ? "saudi|السعود" : "egypt|مصر","i").test(countries);
      const regionBoost = regional ? 28 : 0;
      return {
        name, brand:p.brands || undefined, barcode:p.code ? cleanBarcode(String(p.code)) : undefined, source:regional ? `Open Food Facts · ${cc === "sa" ? "Saudi Arabia" : "Egypt"}` : "Open Food Facts",
        referenceId:p.code, calories100g:n(p.nutriments?.["energy-kcal_100g"]), protein100g:n(p.nutriments?.proteins_100g),
        carbs100g:n(p.nutriments?.carbohydrates_100g), fat100g:n(p.nutriments?.fat_100g), fiber100g:n(p.nutriments?.fiber_100g),
        confidence:regional ? .88 : .75, note:"Open Food Facts · per 100g", relevance:relevance(query,name,p.brands || "") + regionBoost
      } as FoodResult;
    }).filter((x:FoodResult)=>(x.relevance || 0) >= (tokens(query).length > 1 ? 45 : 15) && (x.calories100g || x.protein100g || x.carbs100g));
  } catch { return []; }
}

async function sfdaToken(): Promise<string|null> {
  const id=process.env.SFDA_CLIENT_ID, secret=process.env.SFDA_CLIENT_SECRET, url=process.env.SFDA_TOKEN_URL;
  if (!id || !secret || !url || process.env.SFDA_ENABLED !== "true") return null;
  const cacheKey=`sfda:${id.slice(0,12)}`;
  const shared=await cachedToken(cacheKey);
  if(shared)return shared.value;
  try {
    const body=new URLSearchParams({grant_type:"client_credentials",client_id:id,client_secret:secret});
    const r=await fetchWithTimeout(url,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},body,cache:"no-store"});
    if(!r.ok)return null;
    const data=await r.json();
    const token=data.access_token || data.accessToken || data.token || null;
    if(token){
      const expires=Number(data.expires_in||data.expiresIn||86400);
      const expiresAt=Date.now()+Math.min(Math.max(expires,300),86400)*1000;
      await saveCachedToken(cacheKey,String(token),expiresAt);
      return String(token);
    }
    return null;
  } catch{return null;}
}

function mapSFDA(p:any, barcode?:string): FoodResult|null {
  const x=p?.data || p?.result || p?.product || p;
  if(!x || typeof x !== "object")return null;
  const name=x.productNameAr || x.product_name_ar || x.tradeNameAr || x.trade_name_ar || x.productName || x.tradeName || x.itemDescription || x.name;
  if(!name)return null;
  const code=cleanBarcode(String(x.barcode || x.barCode || x.Barcode || x.gtin || barcode || ""));
  return {name:String(name),brand:x.brandName || x.brand || x.companyName,barcode:code || undefined,source:"SFDA · Saudi Arabia",referenceId:String(x.registrationNumber || x.productNumber || code || ""),
    calories100g:n(x.calories100g ?? x.energyKcal100g ?? x.energy),protein100g:n(x.protein100g ?? x.protein),carbs100g:n(x.carbohydrates100g ?? x.carbohydrates ?? x.carbs),fat100g:n(x.fat100g ?? x.fat),fiber100g:n(x.fiber100g ?? x.fiber),confidence:.99,
    note:"SFDA registered product. Nutrition values are shown only when supplied by the source."};
}

async function searchSFDA(query:string, barcode?:string):Promise<FoodResult[]> {
  const base=process.env.SFDA_FOOD_API_URL, token=await sfdaToken();
  if(!base || !token)return [];
  try {
    const endpoint=barcode ? `${base.replace(/\/$/,"")}/product/barcode/${encodeURIComponent(cleanBarcode(barcode))}` : `${base.replace(/\/$/,"")}/product/search/${encodeURIComponent(query)}/1`;
    const started=Date.now();
    const r=await fetchWithTimeout(endpoint,{cache:"no-store",headers:{Accept:"application/json",Authorization:`Bearer ${token}`}});
    logProviderEvent({requestId:"provider",provider:"SFDA",operation:barcode?"barcode":"search",ok:r.ok,status:r.status,durationMs:Date.now()-started});
    if(!r.ok)return [];
    const data=await r.json();
    const raw=Array.isArray(data)?data:Array.isArray(data?.data)?data.data:Array.isArray(data?.results)?data.results:[data];
    return raw.map((x:any)=>mapSFDA(x,barcode)).filter(Boolean) as FoodResult[];
  } catch{return []}
}

function dedupe(items:FoodResult[]) {
  const seen=new Set<string>();
  return items.filter(x=>{const k=(x.barcode ? `b:${x.barcode}` : `n:${norm(`${x.name}|${x.brand||""}`)}`); if(seen.has(k))return false; seen.add(k); return true;});
}


const responseCache=new Map<string,{expiresAt:number;payload:any}>();
const CACHE_TTL=10*60_000;
export async function GET(req: Request) {
  const rid=requestId();
  try { assertProductionInfrastructure(); } catch { return NextResponse.json({items:[],error:"Server protection is not configured."},{status:503,headers:jsonHeaders(rid)}); }
  const rl=await rateLimitSafe(`food-search:${clientKey(req)}`,40,60_000);
  if(rl.configurationError)return NextResponse.json({items:[],error:"Server protection is temporarily unavailable."},{status:503,headers:jsonHeaders(rid)});
  if(!rl.ok)return NextResponse.json({items:[],primarySource:"rate-limit",error:"Too many searches. Please wait a moment."},{status:429,headers:{...jsonHeaders(rid),"Retry-After":"60"}});
  const {searchParams}=new URL(req.url);
  const q=(searchParams.get("q") || "").trim();
  const barcode=cleanBarcode(searchParams.get("barcode") || "");
  if(!q && !barcode)return NextResponse.json({items:[],source:"none"});
  const cacheKey=`${barcode}|${q.toLowerCase()}`;
  const cached=responseCache.get(cacheKey);
  if(cached && cached.expiresAt>Date.now())return NextResponse.json({...cached.payload,cached:true},{headers:jsonHeaders(rid)});
  const shared=await cacheGet<any>(cacheKey);
  if(shared){responseCache.set(cacheKey,{expiresAt:Date.now()+CACHE_TTL,payload:shared});return NextResponse.json({...shared,cached:true},{headers:jsonHeaders(rid)});}

  if(barcode){
    // Barcode is deliberately source-first: authoritative regional product registry before generic databases.
    const sfda=await searchSFDA("",barcode);
    if(sfda.length){const payload={items:dedupe(sfda),primarySource:"SFDA"};responseCache.set(cacheKey,{expiresAt:Date.now()+CACHE_TTL,payload}); void cacheSet(cacheKey,payload,600); return NextResponse.json(payload,{headers:jsonHeaders(rid)});}

    const off = await Promise.all(["sa","eg"].map(cc => searchOFF(barcode,cc as "sa"|"eg")));
    const offItems=dedupe(off.flat());
    if(offItems.length){const payload={items:offItems,primarySource:"Open Food Facts"};responseCache.set(cacheKey,{expiresAt:Date.now()+CACHE_TTL,payload}); void cacheSet(cacheKey,payload,600); return NextResponse.json(payload,{headers:jsonHeaders(rid)});}

    // USDA does not guarantee packaged barcode coverage, so it is a fallback only.
    const usda=await searchUSDA(barcode);
    if(usda.length){const payload={items:usda,primarySource:"USDA"};responseCache.set(cacheKey,{expiresAt:Date.now()+CACHE_TTL,payload}); void cacheSet(cacheKey,payload,600); return NextResponse.json(payload,{headers:jsonHeaders(rid)});}
    const payload={items:[],primarySource:"none"};responseCache.set(cacheKey,{expiresAt:Date.now()+60_000,payload}); void cacheSet(cacheKey,payload,60); return NextResponse.json(payload,{headers:jsonHeaders(rid)});
  }

  // Staged provider strategy: start with the regional authority, then broaden only
  // when results are weak. This cuts API traffic while keeping a large fallback net.
  const sfda=await searchSFDA(q);
  let off:FoodResult[][]=[];
  let usda:FoodResult[]=[];
  if(sfda.length<5){ off=await Promise.all(["sa","eg"].map(cc=>searchOFF(q,cc as "sa"|"eg"))); }
  if(sfda.length + off.flat().length < 8){ usda=await searchUSDA(q); }
  const all=[...sfda,...off.flat(),...usda,...CURATED.map(x=>({...x,relevance:relevance(q,x.name)}))].filter(x=>(x.relevance || 0) > 0);
  all.sort((a,b)=>regionalScore(b,q)-regionalScore(a,q));
  const payload={items:dedupe(all).slice(0,30),primarySource:sfda.length?"SFDA":off.flat().length?"Open Food Facts":usda.length?"USDA":"Health OS"};
  responseCache.set(cacheKey,{expiresAt:Date.now()+CACHE_TTL,payload});
  return NextResponse.json(payload,{headers:jsonHeaders(rid)});
}
