import test from "node:test";
import assert from "node:assert/strict";

const base = process.env.HEALTH_OS_BASE_URL?.replace(/\/$/,"");

test("production integration smoke (set HEALTH_OS_BASE_URL to run)", async (t) => {
  if (!base) {
    t.skip("Set HEALTH_OS_BASE_URL=https://your-site.netlify.app to run live API smoke tests.");
    return;
  }
  const r = await fetch(`${base}/api/food/search?q=rice`, { headers: { accept:"application/json" }});
  assert.ok([200,429,503].includes(r.status), `unexpected status ${r.status}`);
  if (r.ok) {
    const data = await r.json();
    assert.ok(Array.isArray(data.items));
  }
});

test("production nutrition endpoint rejects empty payload", async (t) => {
  if (!base) { t.skip("Set HEALTH_OS_BASE_URL to run live API smoke tests."); return; }
  const r = await fetch(`${base}/api/nutrition/resolve`, {
    method:"POST", headers:{"content-type":"application/json"},
    body:JSON.stringify({items:[]})
  });
  assert.equal(r.status,400);
});
