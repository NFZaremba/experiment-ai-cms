/**
 * Typed-ish accessors for reading/writing a nested content document by a dotted
 * path. Paths use dots for object keys and numeric segments for array indices,
 * e.g. `hero.title`, `features.items.0.title`, `intro.paragraphs.1.0.text`.
 *
 * This is the single place that translates a `data-content-path` string into a
 * value (and back). Keep it tiny and dependency-free.
 */

type AnyRecord = Record<string, unknown>;

/** Path segments that could pollute Object.prototype — never allowed. */
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** Read the value at `path`, or `undefined` if any segment is missing. */
export function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null) return undefined;
    return (acc as AnyRecord)[key];
  }, obj);
}

/**
 * Return a NEW document with `path` set to `value`. The original is never
 * mutated — only the nodes along the path are cloned (structural sharing for
 * everything else). Arrays stay arrays, objects stay objects.
 */
export function setByPath<T>(obj: T, path: string, value: unknown): T {
  const keys = path.split(".");
  if (keys.some((k) => FORBIDDEN_KEYS.has(k))) {
    throw new Error(`Refusing to write unsafe path: ${path}`);
  }

  function helper(node: unknown, idx: number): unknown {
    const key = keys[idx];
    const isArray = Array.isArray(node);
    const clone: AnyRecord | unknown[] = isArray
      ? [...(node as unknown[])]
      : { ...(node as AnyRecord) };
    const accessor = isArray ? Number(key) : key;

    if (idx === keys.length - 1) {
      (clone as AnyRecord)[accessor as string] = value;
    } else {
      const child = (node as AnyRecord)[accessor as string];
      (clone as AnyRecord)[accessor as string] = helper(child, idx + 1);
    }
    return clone;
  }

  return helper(obj, 0) as T;
}
