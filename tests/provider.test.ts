import test from "node:test";
import assert from "node:assert/strict";
import { chooseBestFood } from "../lib/food-ranking.ts";

test("regional ranking prefers exact/official matches",()=>{
  const best=chooseBestFood([
    {name:"Rice",source:"USDA",confidence:.9,relevance:80},
    {name:"Rice",source:"SFDA · Saudi Arabia",confidence:.99,relevance:70,region:"sa",barcode:"6281234567890"}
  ],"Rice");
  assert.equal(best?.source,"SFDA · Saudi Arabia");
});
