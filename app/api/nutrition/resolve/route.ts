import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Source = "USDA" | "Open Food Facts" | "Health OS curated";

type Candidate = {
  source: Source;
  id?: string;
  name: string;
  brand?: string;
  dataType?: string;
  kcal100g: number;
  protein100g: number;
  carbs100g: number;
  fat100g: number;
  fiber100g?: number;
  confidence: number;
  note?: string;
};

// These are intentionally explicit composite-food estimates. They are used only
// when the photo is a dish (e.g. mandi/kabsa) for which a generic ingredient
// record would be misleading. They are not presented as laboratory measurements.
const CURATED: Record<string, Candidate> = {
  "grilled chicken": { source:"Health OS curated", name:"Grilled chicken breast", kcal100g:165, protein100g:31, carbs100g:0, fat100g:3.6, confidence:.86, note:"Cooked chicken breast; skin/oil can change values." },
  "chicken mandi": { source:"Health OS curated", name:"Chicken mandi", kcal100g:195, protein100g:14.5, carbs100g:14, fat100g:8.2, confidence:.72, note:"Composite dish; recipe and oil vary." },
  "mandi rice": { source:"Health OS curated", name:"Mandi rice", kcal100g:150, protein100g:2.7, carbs100g:27.5, fat100g:3.3, confidence:.70, note:"Prepared rice; recipe/oil vary." },
  "spiced rice": { source:"Health OS curated", name:"Spiced rice", kcal100g:155, protein100g:3.0, carbs100g:28, fat100g:3.5, confidence:.70, note:"Prepared rice; oil/recipe vary." },
  "spiced basmati rice": { source:"Health OS curated", name:"Spiced basmati rice", kcal100g:155, protein100g:3.0, carbs100g:28, fat100g:3.5, confidence:.70, note:"Prepared rice; recipe/oil vary." },
  "basmati rice": { source:"Health OS curated", name:"Cooked basmati rice", kcal100g:130, protein100g:2.7, carbs100g:28.2, fat100g:.3, confidence:.76, note:"Cooked plain basmati rice; oil/sauces are not included." },
  "kabsa rice": { source:"Health OS curated", name:"Kabsa rice", kcal100g:155, protein100g:3, carbs100g:28, fat100g:3.5, confidence:.70, note:"Prepared rice; recipe/oil vary." },
  "chicken kabsa": { source:"Health OS curated", name:"Chicken kabsa", kcal100g:190, protein100g:15, carbs100g:13, fat100g:8, confidence:.70, note:"Composite dish; recipe and oil vary." },
  "shawarma chicken": { source:"Health OS curated", name:"Chicken shawarma", kcal100g:215, protein100g:20, carbs100g:5, fat100g:13, confidence:.68, note:"Recipe and sauces vary." },
  "hummus": { source:"Health OS curated", name:"Hummus", kcal100g:166, protein100g:7.9, carbs100g:14.3, fat100g:9.6, confidence:.78 },
  "foul medames": { source:"Health OS curated", name:"Foul medames", kcal100g:110, protein100g:7.6, carbs100g:19.7, fat100g:.4, confidence:.76, note:"Oil/toppings can materially change calories." },
  "falafel": { source:"Health OS curated", name:"Falafel", kcal100g:333, protein100g:13.3, carbs100g:31.8, fat100g:17.8, confidence:.76 },
  "dates": { source:"Health OS curated", name:"Dates", kcal100g:282, protein100g:2.5, carbs100g:75, fat100g:.4, confidence:.85 },
  "arabic bread": { source:"Health OS curated", name:"Arabic pita bread", kcal100g:275, protein100g:9.1, carbs100g:55.7, fat100g:1.2, confidence:.80 },
  "tahini": { source:"Health OS curated", name:"Tahini", kcal100g:595, protein100g:17, carbs100g:21, fat100g:53, confidence:.80 },
};

function norm(s:string) {
  return s.toLowerCase()
    .replace(/[()\[\],.]/g," ")
    .replace(/\s+/g," ")
    .trim();
}

function num(v:any) {
  const n=Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isDish(q:string) {
  const n=norm(q);
  return /\b(mandi|kabsa|shawarma|biryani|fried rice|spiced rice|fried chicken|curry|stew|pasta dish)\b/.test(n);
}

function queryVariants(q:string) {
  const n=norm(q);
  const out=[q];
  if (/\brice\b/.test(n) && !/\b(raw|dry|uncooked)\b/.test(n)) {
    out.unshift(n.includes("basmati") ? "cooked basmati rice" : "cooked rice");
  }
  if (/\b(grilled|roasted|baked)\s+chicken\b/.test(n)) {
    out.unshift("chicken breast grilled cooked");
  } else if (/\bchicken\b/.test(n) && !/\b(raw|uncooked)\b/.test(n)) {
    out.unshift("chicken cooked");
  }
  if (/\begg\b/.test(n) && !/\braw\b/.test(n)) out.unshift("egg whole cooked");
  if (/\bpotato/.test(n) && !/\b(raw|dry)\b/.test(n)) out.unshift("potato cooked");
  if (/\bpasta\b/.test(n) && !/\bdry\b/.test(n)) out.unshift("pasta cooked");
  return [...new Set(out)].slice(0,3);
}

function curated(q:string) {
  const n=norm(q);
  const exact=CURATED[n];
  if(exact) return exact;
  for(const [key,val] of Object.entries(CURATED)) {
    if(n.includes(key) || key.includes(n)) return val;
  }
  return undefined;
}

function extractNutrients(food:any): Omit<Candidate,"source"|"id"|"name"|"brand"|"dataType"|"confidence"|"note"> | null {
  const nutrients=Array.isArray(food?.foodNutrients) ? food.foodNutrients : [];
  const find=(ids:number[]) => {
    const x=nutrients.find((n:any)=>ids.includes(Number(n.nutrientId)));
    return num(x?.value);
  };
  const kcal=find([1008]);
  const protein=find([1003]);
  const carbs=find([1005]);
  const fat=find([1004]);
  if (!(kcal>0 || protein>0 || carbs>0 || fat>0)) return null;
  return {kcal100g:kcal,protein100g:protein,carbs100g:carbs,fat100g:fat,fiber100g:find([1079])};
}

async function usda(query:string):Promise<Candidate[]> {
  const key=process.env.USDA_FDC_API_KEY;
  if(!key) return [];
  const candidates: Candidate[]=[];
  for (const q of queryVariants(query)) {
    const url=new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
    url.searchParams.set("api_key",key);
    url.searchParams.set("query",q);
    url.searchParams.set("pageSize","12");
    // Generic photo foods should prefer reference/survey foods over branded labels.
    url.searchParams.set("dataType","Foundation,SR Legacy,Survey (FNDDS)");
    const r=await fetch(url,{headers:{"User-Agent":"HealthOS/1.1 personal nutrition app"},cache:"no-store"});
    if(!r.ok) continue;
    const data=await r.json();
    for(const f of (data.foods||[])) {
      const n=extractNutrients(f);
      if(!n) continue;
      candidates.push({
        source:"USDA", id:String(f.fdcId), name:f.description||q,
        brand:f.brandName||f.brandOwner||undefined,
        dataType:f.dataType,
        ...n, confidence:.90
      });
    }
  }
  return candidates;
}

async function off(query:string):Promise<Candidate[]> {
  const url=new URL("https://world.openfoodfacts.org/cgi/search.pl");
  url.searchParams.set("search_terms",query);
  url.searchParams.set("search_simple","1");
  url.searchParams.set("action","process");
  url.searchParams.set("json","1");
  url.searchParams.set("page_size","8");
  url.searchParams.set("fields","code,product_name,brands,nutriments,completeness");
  const r=await fetch(url,{headers:{"User-Agent":"HealthOS/1.1 personal nutrition app"},cache:"no-store"});
  if(!r.ok) return [];
  const data=await r.json();
  return (data.products||[]).map((p:any)=>({
    source:"Open Food Facts",id:p.code,name:p.product_name||query,brand:p.brands,
    kcal100g:num(p.nutriments?.["energy-kcal_100g"]) || num(p.nutriments?.["energy-kcal_value"]),
    protein100g:num(p.nutriments?.proteins_100g),
    carbs100g:num(p.nutriments?.carbohydrates_100g),
    fat100g:num(p.nutriments?.fat_100g),
    fiber100g:num(p.nutriments?.fiber_100g),
    confidence:.76,
    note:p.completeness ? `OFF completeness ${Math.round(Number(p.completeness)*100)}%` : undefined
  })).filter((x:Candidate)=>x.kcal100g>0 || x.protein100g>0 || x.carbs100g>0);
}

function score(c:Candidate,q:string) {
  const a=norm(q), b=norm(c.name);
  const tokens=a.split(" ").filter(Boolean);
  let s=0;
  if(a===b) s+=140;
  if(b.includes(a)||a.includes(b)) s+=55;
  for(const token of tokens) if(b.includes(token)) s+=10;

  const wantsCooked=/\b(cooked|grilled|roasted|baked|fried|prepared|spiced|mandi|kabsa|shawarma)\b/.test(a);
  const candidateRaw=/\b(raw|uncooked|dry|dried)\b/.test(b);
  const candidateCooked=/\b(cooked|grilled|roasted|baked|fried|prepared)\b/.test(b);
  if(wantsCooked && candidateCooked) s+=32;
  if(wantsCooked && candidateRaw) s-=75;

  if(/\brice\b/.test(a) && wantsCooked) {
    if(/\b(dry|uncooked|raw)\b/.test(b)) s-=100;
    if(c.kcal100g>250) s-=55;
    if(c.kcal100g>320) s-=100;
  }
  if(/\bchicken\b/.test(a)) {
    if(/\bskinless\b/.test(b) && !/\bskinless\b/.test(a)) s-=2;
    if(/\bbreast\b/.test(b)) s+=10;
    // A cooked chicken record with very little protein is usually the wrong match.
    if(c.protein100g < 15) s-=35;
    if(c.protein100g >= 20) s+=8;
  }

  // Prefer measured/reference records over the curated estimate when the name is
  // genuinely close, but never allow a generic ingredient to beat a named composite dish.
  if(c.source==="USDA") s+=18;
  if(c.source==="Health OS curated") s+=12;
  if(c.source==="Open Food Facts") s+=4;
  if(c.dataType==="Foundation") s+=8;
  if(c.dataType==="SR Legacy") s+=6;
  if(c.dataType?.includes("Survey")) s+=4;
  if(isDish(q) && c.source==="USDA" && !b.includes(a) && a.split(" ").length>1) s-=18;

  // Macro/calorie consistency check. It catches many bad matches without rejecting
  // legitimate foods that contain fiber, alcohol, or label rounding.
  const implied=4*c.protein100g+4*c.carbs100g+9*c.fat100g;
  if(c.kcal100g>0 && implied>0) {
    const diff=Math.abs(c.kcal100g-implied)/c.kcal100g;
    if(diff>0.45) s-=22;
    else if(diff>0.30) s-=10;
  }
  return s;
}

function matchConfidence(best:Candidate, rawScore:number) {
  const sourceBase=best.source==="USDA" ? .90 : best.source==="Open Food Facts" ? .76 : best.confidence;
  const scoreBoost=Math.max(0,Math.min(.08,(rawScore-80)/250));
  return Math.min(.98,Math.max(.55,sourceBase+scoreBoost));
}

export async function POST(request:Request) {
  try {
    const body=await request.json();
    const items=Array.isArray(body?.items)?body.items:[];
    if(!items.length) return NextResponse.json({error:"No food items supplied."},{status:400});

    const resolved=[];
    for(const raw of items.slice(0,12)) {
      const name=String(raw?.name||"").trim();
      const grams=Math.max(1,num(raw?.estimated_grams)||100);
      if(!name) continue;

      let candidates:Candidate[]=[];
      const local=curated(name);
      if(local) candidates.push(local);

      try { candidates.push(...await usda(name)); } catch(e) { console.warn("USDA lookup failed",e); }
      // OFF is primarily for branded/packaged products. Avoid using it to replace a
      // strong USDA match for a photographed whole food.
      if(candidates.length<3 || candidates.every(c=>c.source!=="USDA")) {
        try { candidates.push(...await off(name)); } catch(e) { console.warn("Open Food Facts lookup failed",e); }
      }

      const ranked=candidates
        .map(c=>({c,s:score(c,name)}))
        .sort((a,b)=>b.s-a.s);
      const best=ranked[0];

      // A match must clear a quality floor. Otherwise we keep Gemini's nutrition
      // estimate rather than silently replacing it with an unrelated food.
      if(!best || best.s < 48) {
        resolved.push({
          ...raw,
          nutrition_source:"Gemini estimate",
          nutrition_database_match:false,
          nutrition_match_confidence:0,
          nutrition_reference_name:null,
          nutrition_reference_id:null,
          nutrition_reference_basis:"AI estimate; no sufficiently strong database match"
        });
        continue;
      }

      const factor=grams/100;
      const confidence=matchConfidence(best.c,best.s);
      resolved.push({
        ...raw,
        calories:Math.round(best.c.kcal100g*factor),
        protein_g:Number((best.c.protein100g*factor).toFixed(1)),
        carbs_g:Number((best.c.carbs100g*factor).toFixed(1)),
        fat_g:Number((best.c.fat100g*factor).toFixed(1)),
        nutrition_source:best.c.source,
        nutrition_database_match:true,
        nutrition_match_confidence:confidence,
        nutrition_reference_name:best.c.name,
        nutrition_reference_id:best.c.id||null,
        nutrition_reference_basis:"per 100g",
        nutrition_note:best.c.note||null
      });
    }

    const total=resolved.reduce((a:any,x:any)=>({
      calories:a.calories+num(x.calories),
      protein_g:a.protein_g+num(x.protein_g),
      carbs_g:a.carbs_g+num(x.carbs_g),
      fat_g:a.fat_g+num(x.fat_g)
    }),{calories:0,protein_g:0,carbs_g:0,fat_g:0});

    return NextResponse.json({
      items:resolved,
      total:{
        calories:Math.round(total.calories),
        protein_g:Number(total.protein_g.toFixed(1)),
        carbs_g:Number(total.carbs_g.toFixed(1)),
        fat_g:Number(total.fat_g.toFixed(1))
      }
    });
  } catch(e) {
    console.error("Nutrition resolver failed",e);
    return NextResponse.json({error:e instanceof Error?e.message:"Nutrition database lookup failed."},{status:500});
  }
}
