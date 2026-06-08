import assert from "node:assert";
import { isOrderValue, isLinkValue, isImageValue } from "../lib/studio/field-types";

assert.equal(isOrderValue(["a", "b"]), true);
assert.equal(isOrderValue([]), true);
assert.equal(isOrderValue("a"), false);
assert.equal(isOrderValue({ src: "x", alt: "" }), false);
// an array must not be mistaken for a link/image value
assert.equal(isLinkValue(["a"] as never), false);
assert.equal(isImageValue(["a"] as never), false);
console.log("field-types ok");
