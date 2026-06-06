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
});

export type Page2Content = z.infer<typeof page2Schema>;
