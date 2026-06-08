import { z } from "zod";

/**
 * Zod schema for the landing-page content document.
 *
 * This schema is the WRITE ALLOWLIST for the AI Content Studio: the editor and
 * the AI rewrite route may only produce a document that parses cleanly here.
 * An unknown path or a wrong-typed value is rejected before it ever reaches a
 * draft or a commit — which is what keeps the content layer unable to express
 * anything but data (never executable code).
 */

/** A rich-text inline segment — `highlight` marks an emphasized phrase. */
const segment = z.object({
  text: z.string(),
  highlight: z.boolean().optional(),
});

/** A rich-text paragraph: an ordered list of inline segments. */
const paragraph = z.array(segment);

/** An editable call-to-action link: label + target + new-tab. */
const link = z.object({
  label: z.string(),
  href: z.string(),
  newTab: z.boolean(),
});

/** An editable image: a URL source (local `/img/...` or Cloudinary CDN) + alt. */
const imageField = z.object({
  src: z.string(),
  alt: z.string(),
});

const milestone = z.object({
  phase: z.string(),
  status: z.enum(["open", "coming-soon"]),
  ctaVariant: z.enum(["light", "dark"]),
  statusText: z.string(),
  title: z.string(),
  description: z.string(),
  link,
});

export const landingSchema = z.object({
  hero: z.object({
    eyebrow: z.string(),
    title: z.string(),
    body: z.string(),
    cta: link,
    commentPeriod: z.object({
      label: z.string(),
      date: z.string(),
    }),
    image: imageField,
  }),
  intro: z.object({
    badge: z.string(),
    title: z.object({ line1: z.string(), line2: z.string() }),
    paragraphs: z.array(paragraph),
  }),
  features: z.object({
    items: z.array(z.object({ title: z.string(), description: z.string() })),
  }),
  tour: z.object({
    badge: z.string(),
    title: z.object({ highlight: z.string(), suffix: z.string() }),
    subtitle: z.string(),
    chapters: z.array(z.object({ label: z.string(), description: z.string() })),
  }),
  vision: z.object({
    badge: z.string(),
    tagline: z.string(),
    stickyStatements: z.array(z.string()),
    paragraphs: z.array(paragraph),
    image: imageField,
  }),
  roadmap: z.object({
    badge: z.string(),
    title: z.object({ highlight: z.string(), suffix: z.string() }),
    intro: z.string(),
    milestones: z.array(milestone),
  }),
  feedback: z.object({
    badge: z.string(),
    title: z.string(),
    body: z.string(),
    ctaAuthed: z.string(),
    ctaAnon: z.string(),
    image: imageField,
  }),
  footer: z.object({
    copyright: z.string(),
    trademark: z.string(),
  }),
});

export type Segment = z.infer<typeof segment>;
export type LandingContent = z.infer<typeof landingSchema>;

/**
 * A second, deliberately minimal page — the multi-page test fixture. Same
 * content-layer contract as the landing page (plain-text leaves), so it's ready
 * to plug into the per-page publish model (see docs/multi-page-publish_checkpoint.md).
 */
export const page2Schema = z.object({
  title: z.string(),
  intro: z.string(),
  sections: z.array(z.object({ heading: z.string(), body: z.string() })),
  // Demo surfaces for AI layout edits (mirror LAYOUT_FIELDS in layout-vocab.ts):
  // a two-column image+text block whose sides swap on `imagePosition`...
  feature: z.object({
    heading: z.string(),
    body: z.string(),
    image: imageField,
    imagePosition: z.enum(["left", "right", "stacked"]).default("right"),
  }),
  // ...and a card collection whose arrangement changes on `layout`.
  cards: z.object({
    layout: z.enum(["grid", "cards", "rows"]).default("grid"),
    items: z.array(z.object({ title: z.string(), body: z.string() })),
  }),
});

export type Page2Content = z.infer<typeof page2Schema>;

/**
 * The "About Us / People-First Places" page — a clean, animation-free copy of a
 * real marketing page, built as a rich playground for constrained AI layout
 * edits. Every section carries a `z.enum(...).default(...)` layout field whose
 * options mirror LAYOUT_FIELDS in layout-vocab.ts; the rest are plain-text /
 * image leaves so the whole document stays data (never executable code).
 */
export const aboutSchema = z.object({
  hero: z.object({
    eyebrow: z.string(),
    title: z.string(),
    subtitle: z.string(),
    textAlign: z.enum(["center", "left"]).default("center"),
  }),
  intro: z.object({
    paragraphs: z.array(z.string()),
    columns: z.enum(["one", "two"]).default("one"),
  }),
  solutions: z.object({
    heading: z.string(),
    columns: z.enum(["four", "three", "two"]).default("four"),
    items: z.array(
      z.object({ icon: z.string(), title: z.string(), body: z.string() })
    ),
  }),
  report: z.object({
    tag: z.string(),
    heading: z.string(),
    body: z.string(),
    cta: z.string(),
    image: imageField,
    imagePosition: z.enum(["left", "right", "stacked"]).default("left"),
  }),
  sum: z.object({
    eyebrow: z.string(),
    heading: z.string(),
    body: z.string(),
    textAlign: z.enum(["left", "center"]).default("left"),
  }),
  team: z.object({
    heading: z.string(),
    cta: z.string(),
    columns: z.enum(["four", "three", "two"]).default("four"),
    members: z.array(z.object({ name: z.string(), role: z.string() })),
  }),
  stats: z.object({
    layout: z.enum(["row", "grid"]).default("row"),
    items: z.array(z.object({ value: z.string(), label: z.string() })),
  }),
});

export type AboutContent = z.infer<typeof aboutSchema>;
