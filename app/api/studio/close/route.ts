import { NextResponse } from "next/server";
import { isStudioAuthed } from "@/lib/studio/auth";
import { closePullRequest, isGithubConfigured } from "@/lib/studio/github";
import { clientIp, rateLimit } from "@/lib/studio/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await isStudioAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isGithubConfigured()) {
    return NextResponse.json({ error: "Publishing isn't configured." }, { status: 503 });
  }
  const rl = rateLimit(`close:${clientIp(req)}`, 30, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { prNumber?: number };
  if (typeof body.prNumber !== "number") {
    return NextResponse.json({ error: "prNumber is required." }, { status: 400 });
  }

  try {
    await closePullRequest(body.prNumber);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
