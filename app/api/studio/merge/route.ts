import { NextResponse } from "next/server";
import { isStudioAuthed } from "@/lib/studio/auth";
import { isGithubConfigured, mergePullRequest } from "@/lib/studio/github";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await isStudioAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isGithubConfigured()) {
    return NextResponse.json({ error: "Publishing isn't configured." }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { prNumber?: number };
  if (typeof body.prNumber !== "number") {
    return NextResponse.json({ error: "prNumber is required." }, { status: 400 });
  }

  try {
    const result = await mergePullRequest(body.prNumber);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: "Merge failed.", detail: String(e) }, { status: 500 });
  }
}
