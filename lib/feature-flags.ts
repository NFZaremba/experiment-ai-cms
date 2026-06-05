/**
 * Feature flags, sourced from `NEXT_PUBLIC_*` env vars at build time.
 *
 * Adding a new flag:
 *   1. Add a `NEXT_PUBLIC_<NAME>_ENABLED` line to .env.local.example
 *   2. Export a corresponding `<NAME>_ENABLED` constant below
 *   3. Document the intended re-enable trigger (release, date, dependency)
 *
 * Defaults to `false` when the env var is missing or malformed — fail-safe.
 */

const parseBoolean = (value: string | undefined): boolean => value === "true";

/**
 * Feedback flow (FAB, landing CTA, account-modal link, mobile nav, admin page).
 * Disabled for Alpha; re-enable for Beta launch by setting the env var to "true".
 */
export const FEEDBACK_ENABLED = parseBoolean(
  process.env.NEXT_PUBLIC_FEEDBACK_ENABLED,
);
