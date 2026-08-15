import Dexie, { type Table } from "dexie";
import type { Profile } from "./health";

export type Meal = { id?: number; name: string; calories: number; protein: number; carbs: number; fat: number; image?: Blob; createdAt: number; mealType?: "Breakfast" | "Lunch" | "Dinner" | "Snack" };
export type WorkoutExercise = { name: string; sets: number; reps: number; weight: number; completed: boolean };
export type Workout = { id?: number; name: string; date: string; duration: number; calories: number; notes: string; exercises: WorkoutExercise[]; completed: boolean; createdAt: number; programId?: number };
export type WeightEntry = { id?: number; weight: number; date: string; note?: string; createdAt: number };
export type Goal = { id?: number; calories: number; protein: number; carbs: number; fat: number; targetWeight: number; updatedAt: number };
export type FoodFavorite = { id?: number; name: string; brand?: string; barcode?: string; source: string; referenceId?: string; calories100g: number; protein100g: number; carbs100g: number; fat100g: number; fiber100g?: number; createdAt: number };
export type DailyCheckin = { id?: number; date: string; water: number; steps: number; sleep: number; mood: number; createdAt: number };
export type ProgramDay = { name: string; exercises: WorkoutExercise[] };
export type WorkoutProgram = { id?: number; name: string; days: ProgramDay[]; updatedAt: number };
export type HuaweiSync = { id?: number; source: "huawei-health"; syncedAt: number; importedAt: number; records: number; note?: string };

class HealthDB extends Dexie {
  meals!: Table<Meal, number>; workouts!: Table<Workout, number>; weights!: Table<WeightEntry, number>; goals!: Table<Goal, number>; checkins!: Table<DailyCheckin, number>; favorites!: Table<FoodFavorite, number>; profiles!: Table<Profile, number>; programs!: Table<WorkoutProgram, number>; huaweiSyncs!: Table<HuaweiSync, number>;
  constructor() {
    super("health-os");
    this.version(6).stores({ meals: "++id, createdAt, mealType", workouts: "++id, date, completed, createdAt, programId", weights: "++id, date, createdAt", goals: "++id, updatedAt", checkins: "++id, date, createdAt", favorites: "++id, name, barcode, createdAt", profiles: "++id, updatedAt", programs: "++id, updatedAt", huaweiSyncs: "++id, source, syncedAt, importedAt" });
  }
}
export const db = new HealthDB();
