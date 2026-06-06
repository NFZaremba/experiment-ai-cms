import landingJson from "./landing.json";
import page2Json from "./page2.json";
import { landingSchema, page2Schema, type LandingContent, type Page2Content } from "./schema";

/**
 * Single import surface for page content.
 *
 * Today this parses static JSON modules. The shape is deliberately
 * CMS-document-shaped, so a future swap to a fetched source is a one-file
 * change here — importers keep calling these getters unchanged. The eventual
 * multi-page model replaces these with a `getPageContent(slug)` registry
 * (see docs/multi-page-publish_checkpoint.md).
 *
 * Parsing/validation happens once and is cached for the module's lifetime.
 */
let cached: LandingContent | null = null;

export function getLandingContent(): LandingContent {
  if (cached === null) {
    cached = landingSchema.parse(landingJson);
  }
  return cached;
}

let cachedPage2: Page2Content | null = null;

/** The minimal second page — multi-page test fixture. */
export function getPage2Content(): Page2Content {
  if (cachedPage2 === null) {
    cachedPage2 = page2Schema.parse(page2Json);
  }
  return cachedPage2;
}

export { landingSchema, page2Schema } from "./schema";
export type { LandingContent, Page2Content, Segment } from "./schema";
export { getByPath, setByPath } from "./get-set-path";
export {
  collectEditablePaths,
  isEditableTextPath,
  getFieldType,
  type FieldType,
} from "./paths";
