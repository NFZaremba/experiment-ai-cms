import assert from "node:assert";
import { aboutSchema } from "../lib/content/schema";
import aboutJson from "../lib/content/about.json";

const doc = aboutSchema.parse(aboutJson);
// every reorderable item has a non-numeric id
for (const it of doc.solutions.items) assert.match(it.id, /^[a-z][a-z0-9-]*$/);
for (const m of doc.team.members) assert.match(m.id, /^[a-z][a-z0-9-]*$/);
// ids are unique within each collection
const sIds = doc.solutions.items.map((i) => i.id);
const tIds = doc.team.members.map((m) => m.id);
assert.equal(new Set(sIds).size, sIds.length);
assert.equal(new Set(tIds).size, tIds.length);
console.log("about-schema ok");
