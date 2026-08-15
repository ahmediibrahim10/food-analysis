import { NextResponse } from "next/server";

type FoodResult = { name: string; brand?: string; barcode?: string; source: string; referenceId?: string; calories100g: number; protein100g: number; carbs100g: number; fat100g: number; fiber100g?: number; confidence: number; note?: string; relevance?: number };
const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, " ").replace(/\s+/g, " ").trim();
const tokens = (s: string) => norm(s).split(" ").filter(x => x.length > 1);
const ARABIC_ALIASES: Record<string, string> = { "فراخ":"chicken", "دجاج":"chicken", "رز":"rice", "مكرونة":"pasta", "مكرونه":"pasta", "بيض":"egg", "لحمة":"beef", "لحمه":"beef", "لحم":"beef", "زبادي":"yogurt", "لبن":"milk", "جبنة":"cheese", "جبنه":"cheese", "شوفان":"oats", "فول":"foul", "حمص":"hummus", "طعمية":"falafel", "طعميه":"falafel", "عيش":"bread", "بطاطس":"potato", "سمك":"fish", "تونة":"tuna", "تونه":"tuna", "موز":"banana", "تفاح":"apple" };
function expandQuery(s: string) { const n = norm(s); return n.split(" ").map(x => ARABIC_ALIASES[x] || x).join(" "); }

const CURATED: FoodResult[] = [
  { name: "Chicken Mandi", source: "Health OS curated", calories100g: 195, protein100g: 14.5, carbs100g: 14, fat100g: 8.2, confidence: .72, note: "Composite dish · per 100g" },
  { name: "Mandi rice", source: "Health OS curated", calories100g: 150, protein100g: 2.7, carbs100g: 27.5, fat100g: 3.3, confidence: .70, note: "Prepared rice · per 100g" },
  { name: "Cooked basmati rice", source: "Health OS curated", calories100g: 130, protein100g: 2.7, carbs100g: 28.2, fat100g: .3, confidence: .76, note: "Cooked plain rice · per 100g" },
  { name: "Chicken shawarma", source: "Health OS curated", calories100g: 215, protein100g: 20, carbs100g: 5, fat100g: 13, confidence: .68, note: "Recipe and sauces vary · per 100g" },
  { name: "Chicken kabsa", source: "Health OS curated", calories100g: 190, protein100g: 15, carbs100g: 13, fat100g: 8, confidence: .70, note: "Composite dish · per 100g" },
  { name: "Hummus", source: "Health OS curated", calories100g: 166, protein100g: 7.9, carbs100g: 14.3, fat100g: 9.6, confidence: .78, note: "Per 100g" },
  { name: "Foul medames", source: "Health OS curated", calories100g: 110, protein100g: 7.6, carbs100g: 19.7, fat100g: .4, confidence: .76, note: "Oil/toppings vary · per 100g" },
  { name: "Falafel", source: "Health OS curated", calories100g: 333, protein100g: 13.3, carbs100g: 31.8, fat100g: 17.8, confidence: .76, note: "Per 100g" },
  { name: "Dates", source: "Health OS curated", calories100g: 282, protein100g: 2.5, carbs100g: 75, fat100g: .4, confidence: .85, note: "Per 100g" },
  { name: "Arabic pita bread", source: "Health OS curated", calories100g: 275, protein100g: 9.1, carbs100g: 55.7, fat100g: 1.2, confidence: .80, note: "Per 100g" },
];

function relevance(query: string, name: string, brand = "") {
  const q = tokens(query), hay = norm(`${name} ${brand}`);
  if (!q.length) return 0;
  const hits = q.filter(x => hay.includes(x));
  if (!hits.length) return 0;
  const all = hits.length === q.length;
  let score = hits.length / q.length * 70;
  if (norm(name) === norm(query)) score += 100;
  if (hay.startsWith(norm(query))) score += 25;
  if (all) score += 25;
  return score;
}

function usdaNutrients(food: any) {
  const ns = Array.isArray(food?.foodNutrients) ? food.foodNutrients : [];
  const find = (ids: number[]) => n(ns.find((x: any) => ids.includes(Number(x.nutrientId)))?.value);
  return { calories100g: find([1008]), protein100g: find([1003]), carbs100g: find([1005]), fat100g: find([1004]), fiber100g: find([1079]) };
}

async function searchUSDA(query: string): Promise<FoodResult[]> {
  query = expandQuery(query);
  const key = process.env.USDA_FDC_API_KEY;
  if (!key) return [];
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", key); url.searchParams.set("query", query); url.searchParams.set("pageSize", "20"); url.searchParams.set("dataType", "Foundation,SR Legacy,Survey (FNDDS),Branded");
  const r = await fetch(url, { cache: "no-store", headers: { "User-Agent": "HealthOS/2.0 personal nutrition app" } });
  if (!r.ok) return [];
  const data = await r.json();
  return (data.foods || []).map((f: any) => ({ name: f.description || query, brand: f.brandName || f.brandOwner || undefined, source: "USDA", referenceId: String(f.fdcId), ...usdaNutrients(f), confidence: f.dataType === "Foundation" ? .94 : .88, note: `${f.dataType || "USDA"} · per 100g`, relevance: relevance(query, f.description || "", f.brandName || f.brandOwner || "") })).filter((x: FoodResult) => (x.relevance || 0) >= (tokens(query).length > 1 ? 50 : 20) && (x.calories100g > 0 || x.protein100g > 0 || x.carbs100g > 0));
}

async function searchOFF(query: string): Promise<FoodResult[]> {
  query = expandQuery(query);
  const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
  url.searchParams.set("search_terms", query); url.searchParams.set("search_simple", "1"); url.searchParams.set("action", "process"); url.searchParams.set("json", "1"); url.searchParams.set("page_size", "20"); url.searchParams.set("fields", "code,product_name,brands,nutriments,completeness");
  const r = await fetch(url, { cache: "no-store", headers: { "User-Agent": "HealthOS/2.0 personal nutrition app" } });
  if (!r.ok) return [];
  const data = await r.json();
  return (data.products || []).map((p: any) => ({ name: p.product_name || query, brand: p.brands || undefined, barcode: p.code, source: "Open Food Facts", referenceId: p.code, calories100g: n(p.nutriments?.["energy-kcal_100g"]), protein100g: n(p.nutriments?.proteins_100g), carbs100g: n(p.nutriments?.carbohydrates_100g), fat100g: n(p.nutriments?.fat_100g), fiber100g: n(p.nutriments?.fiber_100g), confidence: .76, note: p.completeness ? `OFF completeness ${Math.round(Number(p.completeness) * 100)}% · per 100g` : "Open Food Facts · per 100g", relevance: relevance(query, p.product_name || "", p.brands || "") })).filter((x: FoodResult) => (x.relevance || 0) >= (tokens(query).length > 1 ? 55 : 18) && (x.calories100g > 0 || x.protein100g > 0 || x.carbs100g > 0));
}

async function barcodeOFF(code: string): Promise<FoodResult | null> {
  const r = await fetch(`https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(code)}?fields=code,product_name,brands,nutriments,completeness`, { cache: "no-store", headers: { "User-Agent": "HealthOS/2.0 personal nutrition app" } });
  if (!r.ok) return null;
  const data = await r.json(); if (data.status !== 1 || !data.product) return null; const p = data.product;
  return { name: p.product_name || `Barcode ${code}`, brand: p.brands || undefined, barcode: p.code || code, source: "Open Food Facts", referenceId: p.code || code, calories100g: n(p.nutriments?.["energy-kcal_100g"]), protein100g: n(p.nutriments?.proteins_100g), carbs100g: n(p.nutriments?.carbohydrates_100g), fat100g: n(p.nutriments?.fat_100g), fiber100g: n(p.nutriments?.fiber_100g), confidence: .94, note: "Barcode match · Open Food Facts · per 100g" };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url); const query = searchParams.get("q")?.trim() || ""; const barcode = searchParams.get("barcode")?.trim() || "";
    if (!query && !barcode) return NextResponse.json({ error: "Enter a food or barcode." }, { status: 400 });
    if (barcode) { const item = await barcodeOFF(barcode.replace(/\D/g, "")); return NextResponse.json({ items: item ? [item] : [], barcode }); }
    const curated = CURATED.map(x => ({ ...x, relevance: relevance(query, x.name) })).filter(x => (x.relevance || 0) > 0);
    const [u, o] = await Promise.allSettled([searchUSDA(query), searchOFF(query)]);
    const all = [...curated, ...(u.status === "fulfilled" ? u.value : []), ...(o.status === "fulfilled" ? o.value : [])];
    const dedup = new Map<string, FoodResult>();
    for (const item of all.sort((a, b) => (b.relevance || 0) - (a.relevance || 0))) { const key = `${item.source}:${item.referenceId || item.name}`; if (!dedup.has(key)) dedup.set(key, item); }
    return NextResponse.json({ items: Array.from(dedup.values()).slice(0, 15) });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Food search failed." }, { status: 500 }); }
}
