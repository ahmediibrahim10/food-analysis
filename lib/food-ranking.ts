export type RankedFood = {
  name:string; brand?:string; source:string; confidence:number; relevance?:number;
  barcode?:string; region?: "eg"|"sa";
};

export function regionalScore(food: RankedFood, query: string, preferredRegions=("eg","sa") as string[]) {
  const q=query.trim().toLowerCase();
  const n=food.name.trim().toLowerCase();
  let score=(food.relevance||0) + food.confidence*10;
  if(q && q===n) score+=140;
  if(food.barcode && /^\d{8,14}$/.test(food.barcode)) score+=8;
  if(food.region && preferredRegions.includes(food.region)) score+=20;
  if(food.source.toLowerCase().includes("sfda")) score+=25;
  if(food.source.toLowerCase().includes("open food facts")) score+=4;
  return score;
}

export function chooseBestFood<T extends RankedFood>(items:T[], query:string) {
  return [...items].sort((a,b)=>regionalScore(b,query)-regionalScore(a,query))[0] ?? null;
}
