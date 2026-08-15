export type Sex = "male" | "female";
export type GoalMode = "cut" | "maintain" | "bulk";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "high" | "athlete";

export type Profile = {
  id?: number;
  name: string;
  age: number;
  sex: Sex;
  heightCm: number;
  currentWeight: number;
  activity: ActivityLevel;
  goalMode: GoalMode;
  targetWeight: number;
  updatedAt: number;
};

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
  athlete: 1.9,
};

export function calculateTargets(p: Profile) {
  const bmr = p.sex === "male"
    ? 10 * p.currentWeight + 6.25 * p.heightCm - 5 * p.age + 5
    : 10 * p.currentWeight + 6.25 * p.heightCm - 5 * p.age - 161;
  const maintenance = Math.max(1200, Math.round(bmr * ACTIVITY_FACTORS[p.activity]));
  const calories = Math.round(maintenance * (p.goalMode === "cut" ? 0.85 : p.goalMode === "bulk" ? 1.1 : 1));
  const protein = Math.round(Math.max(p.currentWeight * (p.goalMode === "cut" ? 2 : 1.7), 90));
  const fat = Math.round(Math.max(p.currentWeight * 0.75, 45));
  const carbs = Math.max(50, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { bmr: Math.round(bmr), maintenance, calories, protein, carbs, fat };
}

export function daysBetween(a: string, b: string) {
  const ms = new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

export function formatNumber(n: number, digits = 0) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function weightTrend(weights: { weight: number; date: string }[]) {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return { delta: 0, perWeek: 0, direction: "stable" as const };
  const first = sorted[0], last = sorted[sorted.length - 1];
  const weeks = Math.max(daysBetween(first.date, last.date) / 7, 1);
  const delta = last.weight - first.weight;
  const perWeek = delta / weeks;
  return { delta, perWeek, direction: Math.abs(perWeek) < 0.05 ? "stable" as const : perWeek < 0 ? "down" as const : "up" as const };
}

export function dailyRecommendation(args: {
  calories: number; protein: number; goalCalories: number; goalProtein: number; weightPerWeek: number; goalMode: GoalMode;
}) {
  const out: string[] = [];
  const kcalGap = args.goalCalories - args.calories;
  const proteinGap = args.goalProtein - args.protein;
  if (proteinGap > 25) out.push(`Protein is about ${Math.round(proteinGap)}g below target.`);
  if (kcalGap > 450) out.push(`You still have about ${Math.round(kcalGap)} kcal available today.`);
  if (kcalGap < -250) out.push(`You're about ${Math.round(Math.abs(kcalGap))} kcal over today's target.`);
  if (args.goalMode === "cut" && args.weightPerWeek > 0.75) out.push("Weight is dropping quickly; review recovery and intake before cutting more.");
  if (args.goalMode === "cut" && args.weightPerWeek > -0.05 && args.weightPerWeek < 0.05) out.push("Weight has been stable; if your goal is fat loss, review the weekly calorie average.");
  if (!out.length) out.push("Your intake is close to target. Keep the same consistency today.");
  return out;
}
