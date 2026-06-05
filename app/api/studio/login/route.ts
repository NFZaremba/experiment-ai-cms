import { NextResponse } from "next/server";
import { STUDIO_COOKIE, studioToken } from "@/lib/studio/auth";

export async function POST(req: Request) {
  const token = studioToken();

  // No gate configured (dev): accept without setting a cookie.
  if (!token) return NextResponse.json({ ok: true });

  const body = (await req.json().catch(() => ({}))) as { password?: string };
  if (body.password !== token) {
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
