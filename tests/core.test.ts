import test from "node:test";
import assert from "node:assert/strict";
import { nutritionQuality, validateBackup, validateWorkout } from "../lib/validation.ts";

test("nutrition sanity rejects impossible values",()=>{
  assert.equal(nutritionQuality({calories:0,protein:0,carbs:0,fat:0}),"low");
  assert.equal(nutritionQuality({calories:500,protein:25,carbs:50,fat:20}),"high");
});

test("workout validation normalizes safe numeric values",()=>{
  const w=validateWorkout({name:" Bench Press ",date:"2026-08-15",duration:-5,calories:300,notes:"",completed:true,exercises:[{name:"Bench",sets:0,reps:10,weight:-20,completed:true}]});
  assert.equal(w.name,"Bench Press");
  assert.equal(w.duration,0);
  assert.equal(w.exercises[0].sets,1);
  assert.equal(w.exercises[0].weight,0);
});

test("backup validator accepts older versions and rejects future versions",()=>{
  const parsed=validateBackup({version:8,meals:[{id:1}],workouts:[]});
  assert.equal(parsed.version,10);
  assert.throws(()=>validateBackup({version:11,meals:[{id:1}]}));
});

test("backup migration flags older versions and accepts v10",()=>{
  const old=validateBackup({version:8,meals:[{id:1}],workouts:[]});
  assert.equal(old.migrated,true);
  assert.equal(old.migrationPath,"V8 → V10");
  const current=validateBackup({version:10,meals:[{id:1}],workouts:[]});
  assert.equal(current.migrated,false);
  assert.throws(()=>validateBackup({version:11,meals:[{id:1}]}));
});
