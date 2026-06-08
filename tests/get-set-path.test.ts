import assert from "node:assert";
import { getByPath, setByPath } from "../lib/content/get-set-path";

const doc = { team: { members: [
  { id: "rachel", name: "Rachel" },
  { id: "prateek", name: "Prateek" },
] } };

// read by id segment
assert.equal(getByPath(doc, "team.members.prateek.name"), "Prateek");
// read by numeric index still works
assert.equal(getByPath(doc, "team.members.0.name"), "Rachel");
// missing id → undefined
assert.equal(getByPath(doc, "team.members.nope.name"), undefined);

// write by id segment, immutably, without disturbing order
const next = setByPath(doc, "team.members.prateek.name", "Prateek K.");
assert.equal(getByPath(next, "team.members.prateek.name"), "Prateek K.");
assert.equal(getByPath(doc, "team.members.prateek.name"), "Prateek"); // original untouched
assert.equal(getByPath(next, "team.members.0.id"), "rachel"); // order preserved

// writing to a missing id throws (no silent index -1 write)
assert.throws(() => setByPath(doc, "team.members.ghost.name", "x"));
console.log("get-set-path ok");
