export type Nutrition100g = {
  calories100g:number; protein100g:number; carbs100g:number; fat100g:number; fiber100g?:number;
};

const finite = (n:number, fallback=0) => Number.isFinite(n) && n >= 0 ? n : fallback;

export function nutritionForGrams(n:Nutrition100g, grams:number) {
  const g=Math.max(0, finite(Number(grams)));
  const f=g/100;
  return {
    calories:Math.max(0, n.calories100g*f),
    protein:Math.max(0, n.protein100g*f),
    carbs:Math.max(0, n.carbs100g*f),
    fat:Math.max(0, n.fat100g*f),
    fiber:n.fiber100g == null ? undefined : Math.max(0,n.fiber100g*f)
  };
}

export function normalizeNutrition100g(input:Partial<Nutrition100g>): Nutrition100g {
  return {
    calories100g:Math.round(finite(Number(input.calories100g))),
    protein100g:Number(finite(Number(input.protein100g)).toFixed(1)),
    carbs100g:Number(finite(Number(input.carbs100g)).toFixed(1)),
    fat100g:Number(finite(Number(input.fat100g)).toFixed(1)),
    fiber100g:input.fiber100g == null ? undefined : Number(finite(Number(input.fiber100g)).toFixed(1))
  };
}

export function nutritionQuality(n:Nutrition100g) {
  const kcalFromMacros=n.protein100g*4+n.carbs100g*4+n.fat100g*9;
  if (!Number.isFinite(kcalFromMacros) || !Number.isFinite(n.calories100g)) return "low" as const;
  if (n.calories100g <= 0) return "low" as const;
  const ratio=Math.abs(kcalFromMacros-n.calories100g)/Math.max(n.calories100g,1);
  return ratio <= .25 ? "high" as const : ratio <= .45 ? "medium" as const : "low" as const;
}

export function nutritionSanity(n:Nutrition100g) {
  const values = normalizeNutrition100g(n);
  const macroKcal = values.protein100g*4 + values.carbs100g*4 + values.fat100g*9;
  const impossible = values.protein100g > 100 || values.carbs100g > 100 || values.fat100g > 100 || values.calories100g > 900;
  if (impossible) return {ok:false, quality:"low" as const, reason:"Values exceed plausible per-100g limits."};
  if (values.calories100g <= 0 || macroKcal <= 0) return {ok:true, quality:"low" as const, reason:"Incomplete nutrition data."};
  const diff = Math.abs(values.calories100g-macroKcal)/Math.max(values.calories100g,1);
  return {ok:true, quality:diff<=.25?"high" as const:diff<=.45?"medium" as const:"low" as const, reason:diff>.45?"Calories and macros are inconsistent.":undefined};
}
