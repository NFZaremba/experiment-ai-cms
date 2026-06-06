import { NextResponse } from "next/server";
import { isStudioAuthed } from "@/lib/studio/auth";
import { buildContentChangeSet } from "@/lib/studio/changeset";
import { isGithubConfigured, previewUrlFor, publishOrUpdate } from "@/lib/studio/github";
import { clientIp, rateLimit } from "@/lib/studio/rate-limit";
import { isPageSlug } from "@/lib/content/pages";
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

  const body = (await req.json().catch(() => ({}))) as { page?: unknown; edits?: DraftEdits };
  if (!isPageSlug(body.page)) {
    return NextResponse.json({ error: "Unknown page." }, { status: 400 });
  }
  const page = body.page;
  const edits = body.edits ?? {};
  if (Object.keys(edits).length === 0) {
    return NextResponse.json({ error: "No edits to publish." }, { status: 400 });
  }

  let changeSet;
  try {
    changeSet = buildContentChangeSet(page, edits);
  } catch (e) {
    return NextResponse.json(
      { error: "Edits failed validation.", detail: String(e) },
      { status: 422 }
    );
  }

  try {
    // Reconciled against GitHub: advances this page's single open preview,
    // creates its first one, or no-ops when nothing changed — never a duplicate.
    const outcome = await publishOrUpdate(page, changeSet);
    if (outcome.noop) {
      return NextResponse.json({
        noop: true,
        prNumber: outcome.prNumber || undefined,
        prUrl: outcome.prUrl || undefined,
        previewUrl: outcome.prNumber ? previewUrlFor(outcome.prNumber) : undefined,
        headSha: outcome.headSha ?? undefined,
      });
    }
    return NextResponse.json({
      prNumber: outcome.prNumber,
      prUrl: outcome.prUrl,
      previewUrl: previewUrlFor(outcome.prNumber),
      reused: outcome.reused,
      headSha: outcome.headSha ?? undefined,
    });
  } catch (e) {
    return NextResponse.json({ error: "Publish failed.", detail: String(e) }, { status: 500 });
  }
}
