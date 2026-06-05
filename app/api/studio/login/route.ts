import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { STUDIO_COOKIE, studioToken } from "@/lib/studio/auth";
import { clientIp, rateLimit } from "@/lib/studio/rate-limit";

export const runtime = "nodejs";

/** Constant-time string comparison (hash to a fixed length first). */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function POST(req: Request) {
  const token = studioToken();

  // No gate configured (dev): accept without setting a cookie.
  if (!token) return NextResponse.json({ ok: true });

  // Throttle brute-force attempts on the shared password.
  const rl = rateLimit(`login:${clientIp(req)}`, 10, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { password?: string };
  if (typeof body.password !== "string" || !safeEqual(body.password, token)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(STUDIO_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
