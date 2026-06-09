/**
 * The full design-system color palette the Studio offers for text color +
 * background fields. Each key is a token (`<family>-<step>`, or a standalone like
 * `white`) that maps 1:1 to a CSS custom property in app/globals.css
 * (`--color-<key>`) — the IWBI palette, which uses Tailwind-style names but its
 * own values.
 *
 * Styling is applied via the CSS variable (inline `style`), NOT a Tailwind class:
 * Tailwind v4 only generates classes it sees literally in source, so an
 * editor-chosen `text-plum-400` class would never be built. The variable always
 * resolves. `COLOR_KEYS` is the single source of truth for the picker AND the Zod
 * write-allowlist, so content can only ever hold a defined token (data, not code).
 *
 * Keep this list in lockstep with the `--color-*` tokens in globals.css — a key
 * with no matching variable renders as no color (an unresolved `var()`).
 */
export type ColorKey = string;

/** Numeric color families (display order — brand-forward), each with steps 50–900. */
export const COLOR_FAMILIES = [
  "gray",
  "blue",
  "cyan",
  "emerald",
  "plum",
  "bronze",
  "gold",
  "coral",
  "pink",
  "beige",
  "silver",
  "platinum",
] as const;

export const COLOR_STEPS = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"] as const;

/** Standalone tokens that aren't part of a numeric family. */
export const SINGLE_COLOR_KEYS = ["white", "black"] as const;

/** The finite allowlist of color token keys (drives the picker + the Zod enum). */
export const COLOR_KEYS: string[] = [
  ...SINGLE_COLOR_KEYS,
  ...COLOR_FAMILIES.flatMap((f) => COLOR_STEPS.map((s) => `${f}-${s}`)),
];

/** Resolve a token key to its CSS-variable reference for inline styling. */
export function cssVarFor(key: ColorKey): string {
  return `var(--color-${key})`;
}
