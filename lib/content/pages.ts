import { z } from "zod";
import landingJson from "./landing.json";
import page2Json from "./page2.json";
import aboutJson from "./about.json";
import { landingSchema, page2Schema, aboutSchema } from "./schema";

/**
 * Page registry — the single place that maps an editable page to its content
 * file, write-allowlist schema, and route. This is what lets the Studio publish
 * MORE THAN ONE page: each edit set carries a page `slug`, and the publish spine
 * resolves it here to the right file + schema, so a page-2 edit can never touch
 * landing.json. See docs/multi-page-publish_checkpoint.md.
 */

export type PageSlug = "home" | "page-2" | "about";

export type PageDef = {
  slug: PageSlug;
  label: string;
  /** Editable route is `${route}?edit=1`. */
  route: string;
  /** Repo path committed on publish — the per-page write target. */
  file: string;
  /** Static content module (build-time). */
  json: unknown;
  /** Zod write-allowlist for this page's document. */
  schema: z.ZodTypeAny;
};

export const PAGES: Record<PageSlug, PageDef> = {
  home: {
    slug: "home",
    label: "Home",
    route: "/",
    file: "lib/content/landing.json",
    json: landingJson,
    schema: landingSchema,
  },
  "page-2": {
    slug: "page-2",
    label: "About",
    route: "/page-2",
    file: "lib/content/page2.json",
    json: page2Json,
    schema: page2Schema,
  },
  about: {
    slug: "about",
    label: "About Us",
    route: "/about",
    file: "lib/content/about.json",
    json: aboutJson,
    schema: aboutSchema,
  },
};

/** Lightweight list for the shell page-switcher (no json/schema). */
export const PAGE_LIST = Object.values(PAGES).map(({ slug, label, route }) => ({
  slug,
  label,
  route,
}));

export function isPageSlug(v: unknown): v is PageSlug {
  return typeof v === "string" && v in PAGES;
}

/** Which page is rendered at a pathname — used by the bridge to self-identify. */
export function pageSlugForPathname(pathname: string): PageSlug {
  const match = (Object.values(PAGES) as PageDef[]).find((p) => p.route === pathname);
  return match?.slug ?? "home";
}
