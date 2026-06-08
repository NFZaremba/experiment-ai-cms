import assert from "node:assert";
import { buildContentChangeSet } from "../lib/studio/changeset";

function parse(cs: { files: { newContents: string }[] }) {
  return JSON.parse(cs.files[0].newContents);
}

// reorder alone permutes the array
const a = parse(buildContentChangeSet("about", { "team.members": ["jessica-cooper", "rachel-hodgdon"] }));
assert.equal(a.team.members[0].id, "jessica-cooper");
assert.equal(a.team.members[1].id, "rachel-hodgdon");
assert.equal(a.team.members.length, 11); // unnamed members appended

// reorder + id-keyed text edit coexist, regardless of key order
const edits1 = {
  "team.members": ["jessica-cooper", "rachel-hodgdon"],
  "team.members.rachel-hodgdon.name": "Rachel H.",
};
const b = parse(buildContentChangeSet("about", edits1));
assert.equal(b.team.members[0].id, "jessica-cooper");
const rachelB = b.team.members.find((m: { id: string }) => m.id === "rachel-hodgdon");
assert.equal(rachelB.name, "Rachel H.");

// same edits, reversed insertion order → identical result
const edits2 = {
  "team.members.rachel-hodgdon.name": "Rachel H.",
  "team.members": ["jessica-cooper", "rachel-hodgdon"],
};
const c = parse(buildContentChangeSet("about", edits2));
assert.deepEqual(c.team.members.map((m: { id: string }) => m.id), b.team.members.map((m: { id: string }) => m.id));
assert.equal(c.team.members.find((m: { id: string }) => m.id === "rachel-hodgdon").name, "Rachel H.");
console.log("changeset-reorder ok");
