import { NextResponse } from "next/server";
import { isStudioAuthed } from "@/lib/studio/auth";
import { findOpenStudioPRForPage, isGithubConfigured, previewUrlFor } from "@/lib/studio/github";
import { isPageSlug } from "@/lib/content/pages";

export const runtime = "nodejs";

/**
 * Reconcile-on-load: returns the current open preview for a page from GitHub
 * truth (or null). The client hydrates that page's `lastPublish` from this on
 * mount / page-switch, so a fresh tab/browser discovers the existing preview
 * instead of spawning a duplicate — and a stale local pointer to a closed PR
 * gets cleared.
 */
export async function GET(req: Request) {
  if (!(await isStudioAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isGithubConfigured()) {
    return NextResponse.json({ error: "Publishing isn't configured." }, { status: 503 });
  }

  const page = new URL(req.url).searchParams.get("page");
  if (!isPageSlug(page)) {
    return NextResponse.json({ error: "Unknown page." }, { status: 400 });
  }

  try {
    const open = await findOpenStudioPRForPage(page);
    const newest = open[0] ?? null;
    return NextResponse.json({
      preview: newest
        ? {
            prNumber: newest.prNumber,
            prUrl: newest.prUrl,
            previewUrl: previewUrlFor(newest.prNumber),
            headSha: newest.headSha,
          }
        : null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
