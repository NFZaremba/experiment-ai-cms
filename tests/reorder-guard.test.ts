import assert from "node:assert";
import { reorderById } from "../lib/studio/order";
import { buildContentChangeSet } from "../lib/studio/changeset";

// --- reorderById dedupe: a repeated id never duplicates an item ---
const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
assert.deepEqual(reorderById(items, ["a", "a", "b"]).map((x) => x.id), ["a", "b", "c"]);
assert.deepEqual(reorderById(items, ["c", "c", "c"]).map((x) => x.id), ["c", "a", "b"]);

// --- publish boundary: a crafted duplicate-id order cannot inject content ---
const ids11 = [
  "rachel-hodgdon", "prateek-khanna", "judith-webb", "jessica-cooper", "jason-hartke",
  "xue-ya", "lindsay-jacobs", "jodie-pimentel", "paul-scialla", "rick-fedrizzi",
  "kimberly-lewis-inkumsah",
];
const dupOrder = ["rachel-hodgdon", ...ids11]; // rachel twice
const out = JSON.parse(buildContentChangeSet("about", { "team.members": dupOrder }).files[0].newContents);
assert.equal(out.team.members.length, 11, "no duplication — still 11 members");
assert.equal(out.team.members.filter((m: { id: string }) => m.id === "rachel-hodgdon").length, 1, "rachel appears once");
assert.equal(new Set(out.team.members.map((m: { id: string }) => m.id)).size, 11, "all ids unique");

// --- guard: an order edit on an array whose items lack string ids fails loudly ---
assert.throws(() => buildContentChangeSet("about", { "intro.paragraphs": ["0", "1"] }), /lack string ids/);

console.log("reorder-guard ok");
