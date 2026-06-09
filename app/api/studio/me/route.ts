import { NextResponse } from "next/server";
import { isStudioAuthed } from "@/lib/studio/auth";

export const runtime = "nodejs";

/**
 * Returns whether the caller is an authed studio user. The studio_auth cookie is
 * httpOnly (not client-readable), so StudioMount calls this on mount to decide
 * whether to show the ✦ edit pencil. Keeping the check here (not in the root
 * layout) lets the public marketing pages stay statically generated / CDN-cached
 * even when STUDIO_AUTH_TOKEN is set — best for speed + Core Web Vitals (SEO).
 *
 * Always 200 with a boolean (never 401) — "not authed" is a normal answer here,
 * not an error, and anonymous visitors hit this on every page load.
 */
export async function GET() {
  return NextResponse.json(
    { authed: await isStudioAuthed() },
    { headers: { "cache-control": "no-store" } }
  );
}
