import landingJson from "./landing.json";
import { landingSchema, type LandingContent } from "./schema";

/**
 * Single import surface for landing-page content.
 *
 * Today this parses a static JSON module. The shape is deliberately
 * CMS-document-shaped, so a future swap to a fetched source is a one-file
 * change here — importers keep calling `getLandingContent()` unchanged.
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

export { landingSchema } from "./schema";
export type { LandingContent, Segment } from "./schema";
export { getByPath, setByPath } from "./get-set-path";
export {
  collectEditablePaths,
  isEditableTextPath,
  getFieldType,
  type FieldType,
} from "./paths";
