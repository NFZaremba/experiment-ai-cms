import assert from "node:assert";
import { reorderById } from "../lib/studio/order";

const items = [{ id: "a", n: 1 }, { id: "b", n: 2 }, { id: "c", n: 3 }];

// full permutation
assert.deepEqual(reorderById(items, ["c", "a", "b"]).map((x) => x.id), ["c", "a", "b"]);
// ids not named in order are appended in original relative order
assert.deepEqual(reorderById(items, ["b"]).map((x) => x.id), ["b", "a", "c"]);
// unknown ids in order are ignored
assert.deepEqual(reorderById(items, ["zzz", "c"]).map((x) => x.id), ["c", "a", "b"]);
// empty order → unchanged
assert.deepEqual(reorderById(items, []).map((x) => x.id), ["a", "b", "c"]);
console.log("order ok");
