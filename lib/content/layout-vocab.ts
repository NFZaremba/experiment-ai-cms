/**
 * The constrained layout vocabulary — the SINGLE allowlist behind both the
 * studio panel's dropdowns and the AI route.
 *
 * A developer pre-builds these variants in the components; editors (and the AI)
 * may only ever pick from these values. The AI is a natural-language front-end
 * to this exact set — it is forced (via tool-use) into one of these options and
 * the server re-validates against this registry, so it can never exceed what's
 * allowed here, and never emits code.
 *
 * Paths are relative to their page's content file (e.g. "feature.imagePosition"
 * and "cards.layout" in page2.json). Keep the Zod `z.enum` for each path in
 * schema.ts in sync with the `options` here.
 *
 * v1 demo surface is the page-2 fixture (zero production risk); the registry +
 * the variant pattern extend to real landing sections section-by-section.
 *
 * LIMITATION: fields are keyed by `path` GLOBALLY, not by (page, path). Two pages
 * therefore cannot share a layout path with different options. Today this is safe
 * because every page uses unique section keys (page-2: feature/cards; about:
 * hero/intro/solutions/report/sum/team/stats). If pages ever need the same path
 * with different options, scope this registry — and the ai-layout route — by page.
 */

export type LayoutOption = { value: string; label: string };

export type LayoutField = {
  /** content path, relative to its page file */
  path: string;
  /** the section this control belongs to (groups controls in the panel) */
  section: string;
  /** control label shown in the panel, e.g. "Layout" */
  label: string;
  options: readonly LayoutOption[];
  default: string;
};

export const LAYOUT_FIELDS: readonly LayoutField[] = [
  {
    path: "feature.imagePosition",
    section: "feature",
    label: "Image position",
    options: [
      { value: "right", label: "Image right" },
      { value: "left", label: "Image left" },
      { value: "stacked", label: "Stacked" },
    ],
    default: "right",
  },
  {
    path: "cards.layout",
    section: "cards",
    label: "Layout",
    options: [
      { value: "grid", label: "Grid" },
      { value: "cards", label: "Cards" },
      { value: "rows", label: "Rows" },
    ],
    default: "grid",
  },

  // --- About Us page (/about) ---
  {
    path: "hero.textAlign",
    section: "hero",
    label: "Heading alignment",
    options: [
      { value: "center", label: "Centered" },
      { value: "left", label: "Left" },
    ],
    default: "center",
  },
  {
    path: "intro.columns",
    section: "intro",
    label: "Text columns",
    options: [
      { value: "one", label: "Single column" },
      { value: "two", label: "Two columns" },
    ],
    default: "one",
  },
  {
    path: "solutions.columns",
    section: "solutions",
    label: "Columns",
    options: [
      { value: "four", label: "Four across" },
      { value: "three", label: "Three across" },
      { value: "two", label: "Two across" },
    ],
    default: "four",
  },
  {
    path: "report.imagePosition",
    section: "report",
    label: "Image position",
    options: [
      { value: "left", label: "Image left" },
      { value: "right", label: "Image right" },
      { value: "stacked", label: "Stacked" },
    ],
    default: "left",
  },
  {
    path: "sum.textAlign",
    section: "sum",
    label: "Text alignment",
    options: [
      { value: "left", label: "Left" },
      { value: "center", label: "Centered" },
    ],
    default: "left",
  },
  {
    path: "team.columns",
    section: "team",
    label: "Columns",
    options: [
      { value: "four", label: "Four across" },
      { value: "three", label: "Three across" },
      { value: "two", label: "Two across" },
    ],
    default: "four",
  },
  {
    path: "stats.layout",
    section: "stats",
    label: "Layout",
    options: [
      { value: "row", label: "Single row" },
      { value: "grid", label: "Grid" },
    ],
    default: "row",
  },
] as const;

const BY_PATH = new Map(LAYOUT_FIELDS.map((f) => [f.path, f]));

export function layoutFieldFor(path: string): LayoutField | null {
  return BY_PATH.get(path) ?? null;
}

export function layoutOptionsFor(path: string): readonly LayoutOption[] | null {
  return BY_PATH.get(path)?.options ?? null;
}

export function isLayoutPath(path: string): boolean {
  return BY_PATH.has(path);
}

/** Server-authoritative re-validation: the AI's output must land here. */
export function isValidLayout(path: string, value: unknown): boolean {
  const f = BY_PATH.get(path);
  return !!f && typeof value === "string" && f.options.some((o) => o.value === value);
}

export function defaultLayout(path: string): string | null {
  return BY_PATH.get(path)?.default ?? null;
}

/** All controls in the same section as `path` — so the panel can list a
 *  section's full set of constrained inputs together. */
export function sectionControlsFor(path: string): readonly LayoutField[] {
  const f = BY_PATH.get(path);
  if (!f) return [];
  return LAYOUT_FIELDS.filter((x) => x.section === f.section);
}
