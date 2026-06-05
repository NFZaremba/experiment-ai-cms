import { NextResponse } from "next/server";
import { isStudioAuthed } from "@/lib/studio/auth";
import { buildContentChangeSet } from "@/lib/studio/changeset";
import { isGithubConfigured, publishChangeSet } from "@/lib/studio/github";
import { clientIp, rateLimit } from "@/lib/studio/rate-limit";
import type { DraftEdits } from "@/lib/studio/draft-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await isStudioAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimit(`publish:${clientIp(req)}`, 30, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many publishes. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }
  if (!isGithubConfigured()) {
    return NextResponse.json(
      { error: "Publishing isn't configured. Set GITHUB_TOKEN, GITHUB_REPO_OWNER, GITHUB_REPO_NAME." },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { edits?: DraftEdits };
  const edits = body.edits ?? {};
  if (Object.keys(edits).length === 0) {
    return NextResponse.json({ error: "No edits to publish." }, { status: 400 });
  }

  let changeSet;
  try {
    changeSet = buildContentChangeSet(edits);
  } catch (e) {
    return NextResponse.json(
      { error: "Edits failed validation.", detail: String(e) },
      { status: 422 }
    );
  }

  const branch = `studio/edit-${Date.now()}`;
  try {
    const { prNumber, prUrl } = await publishChangeSet(branch, changeSet);
    const site = process.env.NETLIFY_SITE_NAME;
    const previewUrl = site
      ? `https://deploy-preview-${prNumber}--${site}.netlify.app`
      : null;
    return NextResponse.json({ prNumber, prUrl, previewUrl });
  } catch (e) {
    return NextResponse.json({ error: "Publish failed.", detail: String(e) }, { status: 500 });
  }
}
