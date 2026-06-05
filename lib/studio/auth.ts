import "server-only";
import { cookies } from "next/headers";

/**
 * Studio gate (v1): a single shared password compared against STUDIO_AUTH_TOKEN.
 * On success a httpOnly cookie holding the token is set; access is granted while
 * the cookie matches.
 *
 * Dev convenience: if STUDIO_AUTH_TOKEN is unset, access is allowed OUTSIDE
 * production (so you can test locally without configuring a secret). In
 * production with no token set, access is denied (fail closed).
 */

export const STUDIO_COOKIE = "studio_auth";

export function studioToken(): string | undefined {
  return process.env.STUDIO_AUTH_TOKEN || undefined;
}

export async function isStudioAuthed(): Promise<boolean> {
  const token = studioToken();
  if (!token) return process.env.NODE_ENV !== "production";
  const jar = await cookies();
  return jar.get(STUDIO_COOKIE)?.value === token;
}
