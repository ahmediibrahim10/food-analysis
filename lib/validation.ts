export type NutritionValues = { calories:number; protein:number; carbs:number; fat:number };

export function nonNegative(value: unknown, fallback = 0): number {
  const n=Number(value); return Number.isFinite(n) && n>=0 ? n : fallback;
}
export function validateNutrition(values: NutritionValues): NutritionValues {
  return { calories:Math.round(nonNegative(values.calories)), protein:Number(nonNegative(values.protein).toFixed(1)), carbs:Number(nonNegative(values.carbs).toFixed(1)), fat:Number(nonNegative(values.fat).toFixed(1)) };
}
export function nutritionQuality(values: NutritionValues): "high"|"medium"|"low" {
  const v=validateNutrition(values), implied=v.protein*4+v.carbs*4+v.fat*9;
  if(v.calories<=0 || implied<=0) return "low";
  const diff=Math.abs(implied-v.calories)/Math.max(v.calories,1);
  if(diff<=.30)return "high"; if(diff<=.50)return "medium"; return "low";
}
export function validateWorkout(input:any) {
  const name=String(input.name??"").trim(); if(!name)throw new Error("Workout name is required.");
  const date=String(input.date??""); if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error("Workout date is invalid.");
  const duration=Math.min(1440,nonNegative(input.duration)); const calories=Math.min(20000,nonNegative(input.calories));
  const exercises=(Array.isArray(input.exercises)?input.exercises:[]).map((e:any)=>{
    const exerciseName=String(e.name??"").trim(); if(!exerciseName)throw new Error("Every exercise needs a name.");
    return {name:exerciseName.slice(0,120),sets:Math.min(100,Math.max(1,Math.floor(nonNegative(e.sets,1)))),reps:Math.min(1000,Math.max(1,Math.floor(nonNegative(e.reps,1)))),weight:Math.min(1000,nonNegative(e.weight)),completed:Boolean(e.completed)};
  });
  return {name:name.slice(0,160),date,duration,calories,notes:String(input.notes??"").slice(0,2000),exercises,completed:Boolean(input.completed),programId:input.programId};
}

const TABLES=["meals","workouts","weights","goals","checkins","favorites","profiles","programs","huaweiSyncs","localProducts"] as const;

function migrateRow(table:string,row:any) {
  if(!row || typeof row!=="object") return null;
  const x={...row};
  if(table==="meals"){
    x.calories=Math.max(0,Number(x.calories)||0); x.protein=Math.max(0,Number(x.protein)||0);
    x.carbs=Math.max(0,Number(x.carbs)||0); x.fat=Math.max(0,Number(x.fat)||0);
    x.createdAt=Number(x.createdAt)||Date.now();
  }
  if(table==="workouts"){
    x.exercises=Array.isArray(x.exercises)?x.exercises.map((e:any)=>({
      name:String(e?.name||"Exercise").trim().slice(0,120),
      sets:Math.max(1,Math.min(100,Math.floor(nonNegative(e?.sets,1)))),
      reps:Math.max(1,Math.min(1000,Math.floor(nonNegative(e?.reps,1)))),
      weight:Math.max(0,Math.min(1000,nonNegative(e?.weight))),
      completed:Boolean(e?.completed)
    })):[]; x.createdAt=Number(x.createdAt)||Date.now();
  }
  if(table==="weights") x.weight=Math.max(0,Number(x.weight)||0);
  if(table==="checkins"){x.water=Math.max(0,Number(x.water)||0);x.steps=Math.max(0,Number(x.steps)||0);x.sleep=Math.max(0,Number(x.sleep)||0);}
  if(table==="localProducts"){x.barcode=String(x.barcode||"").replace(/\D/g,"");}
  return x;
}

export function migrateBackup(raw:any){
  if(!raw||typeof raw!=="object"||!Number.isFinite(Number(raw.version)))throw new Error("Invalid backup format.");
  const version=Number(raw.version); if(version>10)throw new Error("This backup was created by a newer app version.");
  const tables:Record<string,unknown[]>={}; let count=0;
  for(const table of TABLES){
    const value=Array.isArray(raw[table])?raw[table]:[];
    tables[table]=value.map(x=>migrateRow(table,x)).filter(Boolean);
    count+=tables[table].length;
  }
  if(!count)throw new Error("Backup contains no application data.");
  return {version:10,sourceVersion:version,tables,count,migrated:version<10,migrationPath:version<10?`V${version} → V10`:"V10"};
}
export const validateBackup=migrateBackup;
