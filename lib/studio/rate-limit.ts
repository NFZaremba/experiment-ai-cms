import "server-only";

/**
 * Minimal in-memory sliding-window rate limiter for the Studio API routes
 * (chiefly to blunt brute-forcing the shared login password).
 *
 * CAVEAT: this is per-process. On serverless (Netlify Functions) each instance
 * has its own map, so it's best-effort — it stops casual/single-source brute
 * force but not a distributed attack. For production-grade limiting, back this
 * with Netlify Blobs (the kv-store pattern planned for the AI route). Combined
 * with the constant-time password compare, this is adequate for v1.
 */

const store = new Map<string, number[]>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const hits = (store.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    store.set(key, hits);
    const retryAfter = Math.ceil((windowMs - (now - hits[0])) / 1000);
    return { ok: false, retryAfter };
  }
  hits.push(now);
  store.set(key, hits);
  return { ok: true, retryAfter: 0 };
}

/** Best-effort client IP from proxy headers. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-nf-client-connection-ip") || "unknown";
}
