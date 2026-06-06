import { NextResponse } from "next/server";
import { isStudioAuthed } from "@/lib/studio/auth";
import { getPullStatus, isGithubConfigured } from "@/lib/studio/github";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!(await isStudioAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isGithubConfigured()) {
    return NextResponse.json({ error: "Publishing isn't configured." }, { status: 503 });
  }

  const params = new URL(req.url).searchParams;
  const pr = Number(params.get("pr"));
  const sha = params.get("sha") || undefined;
  if (!Number.isInteger(pr)) {
    return NextResponse.json({ error: "pr is required" }, { status: 400 });
  }

  try {
    const state = await getPullStatus(pr, sha);
    return NextResponse.json({ state });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
