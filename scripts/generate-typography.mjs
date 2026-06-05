/**
 * Generate typography CSS utilities with correct capsize trim values.
 *
 * Reads font metrics from local font files and uses @capsizecss/core
 * to compute mathematically correct ::before/::after margins that trim
 * leading whitespace from text.
 *
 * Usage: node scripts/generate-typography.mjs
 * Output: app/generated-typography.css
 */

import { createStyleObject } from "@capsizecss/core";
import { fromBuffer } from "@capsizecss/unpack";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// 1. Extract font metrics
// ---------------------------------------------------------------------------

const ftmadeMetrics = await fromBuffer(
  readFileSync(resolve(ROOT, "public/fonts/FT-Made/FTMade-Regular.ttf"))
);

const mazzardMetrics = await fromBuffer(
  readFileSync(resolve(ROOT, "public/fonts/Mazzard-M/mazzardsoftm-regular.otf"))
);

console.log("FtMade metrics:", JSON.stringify(ftmadeMetrics, null, 2));
console.log("Mazzard metrics:", JSON.stringify(mazzardMetrics, null, 2));

// ---------------------------------------------------------------------------
// 2. Type scale definitions
// ---------------------------------------------------------------------------

const definitions = [
  // Headings — FtMade
  {
    name: "heading-xlarge",
    fontFamily: "var(--font-ftmade)",
    fontSize: 58,
    lineHeight: 64,
    letterSpacing: "-0.58px",
    metrics: ftmadeMetrics,
    mobile: { fontSize: 36, lineHeight: 40, letterSpacing: "-0.36px" },
  },
  {
    name: "heading-large",
    fontFamily: "var(--font-ftmade)",
    fontSize: 38,
    lineHeight: 40,
    letterSpacing: "-0.38px",
    metrics: ftmadeMetrics,
    mobile: { fontSize: 28, lineHeight: 32, letterSpacing: "-0.28px" },
  },
  {
    name: "heading-medium",
    fontFamily: "var(--font-ftmade)",
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: "-0.34px",
    metrics: ftmadeMetrics,
    mobile: { fontSize: 26, lineHeight: 30, letterSpacing: "-0.26px" },
  },
  {
    name: "heading-small",
    fontFamily: "var(--font-ftmade)",
    fontSize: 30,
    lineHeight: 32,
    letterSpacing: "-0.3px",
    metrics: ftmadeMetrics,
    mobile: { fontSize: 24, lineHeight: 28, letterSpacing: "-0.24px" },
  },
  {
    name: "heading-xsmall",
    fontFamily: "var(--font-ftmade)",
    fontSize: 22,
    lineHeight: 24,
    letterSpacing: "-0.22px",
    metrics: ftmadeMetrics,
  },
  {
    name: "heading-xxsmall",
    fontFamily: "var(--font-ftmade)",
    fontSize: 20,
    lineHeight: 22,
    letterSpacing: "-0.22px",
    metrics: ftmadeMetrics,
  },

  // Body — Mazzard Soft M
  {
    name: "body-large",
    fontSize: 18,
    lineHeight: 25.2,
    fontWeight: 400,
    metrics: mazzardMetrics,
    mobile: { fontSize: 16, lineHeight: 22.4 },
  },
  {
    name: "body-base",
    fontSize: 16,
    lineHeight: 22.4,
    fontWeight: 400,
    metrics: mazzardMetrics,
    mobile: { fontSize: 14, lineHeight: 19.6 },
  },
  {
    name: "body-small",
    fontSize: 14,
    lineHeight: 19.6,
    fontWeight: 400,
    metrics: mazzardMetrics,
    mobile: { fontSize: 12, lineHeight: 16.8 },
  },

  // Overlines — Mazzard Soft M
  {
    name: "overline-large",
    fontSize: 14,
    lineHeight: 14,
    fontWeight: 600,
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    metrics: mazzardMetrics,
  },
  {
    name: "overline-medium",
    fontSize: 12,
    lineHeight: 12,
    fontWeight: 600,
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    metrics: mazzardMetrics,
  },
  {
    name: "overline-small",
    fontSize: 10,
    lineHeight: 10,
    fontWeight: 600,
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    metrics: mazzardMetrics,
  },

  // Numbers — Mazzard Soft M
  {
    name: "number-large",
    fontSize: 18,
    lineHeight: 25.2,
    fontWeight: 400,
    fontVariantNumeric: "lining-nums tabular-nums",
    metrics: mazzardMetrics,
    mobile: { fontSize: 16, lineHeight: 22.4 },
  },
  {
    name: "number-base",
    fontSize: 16,
    lineHeight: 22.4,
    fontWeight: 400,
    fontVariantNumeric: "lining-nums tabular-nums",
    metrics: mazzardMetrics,
    mobile: { fontSize: 14, lineHeight: 19.6 },
  },
  {
    name: "number-small",
    fontSize: 14,
    lineHeight: 19.6,
    fontWeight: 400,
    fontVariantNumeric: "lining-nums tabular-nums",
    metrics: mazzardMetrics,
    mobile: { fontSize: 12, lineHeight: 16.8 },
  },
  {
    name: "number-xsmall",
    fontSize: 14,
    lineHeight: 16.8,
    fontWeight: 400,
    fontVariantNumeric: "lining-nums tabular-nums",
    metrics: mazzardMetrics,
    mobile: { fontSize: 12, lineHeight: 14.4 },
  },
];

// ---------------------------------------------------------------------------
// 3. Generate CSS
// ---------------------------------------------------------------------------

function generateUtility(def) {
  const capsize = createStyleObject({
    fontSize: def.fontSize,
    leading: def.lineHeight,
    fontMetrics: def.metrics,
  });

  const lines = [`@utility ${def.name} {`];

  if (def.fontFamily) lines.push(`  font-family: ${def.fontFamily};`);
  lines.push(`  font-size: ${capsize.fontSize};`);
  if (def.fontWeight) lines.push(`  font-style: normal;`);
  if (def.fontWeight) lines.push(`  font-weight: ${def.fontWeight};`);
  lines.push(`  line-height: ${capsize.lineHeight};`);
  if (def.letterSpacing) lines.push(`  letter-spacing: ${def.letterSpacing};`);
  if (def.textTransform) lines.push(`  text-transform: ${def.textTransform};`);
  if (def.fontVariantNumeric)
    lines.push(`  font-variant-numeric: ${def.fontVariantNumeric};`);

  // ::before trim
  const before = capsize["::before"];
  lines.push("");
  lines.push("  &::before {");
  lines.push(`    content: ${before.content};`);
  lines.push(`    margin-bottom: ${before.marginBottom};`);
  lines.push(`    display: ${before.display};`);
  lines.push("  }");

  // ::after trim
  const after = capsize["::after"];
  lines.push("  &::after {");
  lines.push(`    content: ${after.content};`);
  lines.push(`    margin-top: ${after.marginTop};`);
  lines.push(`    display: ${after.display};`);
  lines.push("  }");

  lines.push("}");
  return lines.join("\n");
}

function generateMobileOverride(def) {
  const capsize = createStyleObject({
    fontSize: def.mobile.fontSize,
    leading: def.mobile.lineHeight,
    fontMetrics: def.metrics,
  });

  const lines = [`  .${def.name} {`];
  lines.push(`    font-size: ${capsize.fontSize};`);
  lines.push(`    line-height: ${capsize.lineHeight};`);
  if (def.mobile.letterSpacing) {
    lines.push(`    letter-spacing: ${def.mobile.letterSpacing};`);
  }

  lines.push("    &::before {");
  lines.push(`      margin-bottom: ${capsize["::before"].marginBottom};`);
  lines.push("    }");
  lines.push("    &::after {");
  lines.push(`      margin-top: ${capsize["::after"].marginTop};`);
  lines.push("    }");

  lines.push("  }");
  return lines.join("\n");
}

const header = `/* =============================================================================
   AUTO-GENERATED by scripts/generate-typography.mjs — DO NOT EDIT MANUALLY
   Regenerate: npm run generate:typography
   ============================================================================= */`;

const sections = {
  "Heading Utilities": definitions.filter((d) => d.name.startsWith("heading-")),
  "Body Utilities": definitions.filter((d) => d.name.startsWith("body-")),
  "Overline Utilities": definitions.filter((d) => d.name.startsWith("overline-")),
  "Number Utilities": definitions.filter((d) => d.name.startsWith("number-")),
};

const parts = [header, ""];

for (const [section, defs] of Object.entries(sections)) {
  parts.push(`/* ${section} */`);
  for (const def of defs) {
    parts.push(generateUtility(def));
  }
  parts.push("");
}

const mobileDefs = definitions.filter((d) => d.mobile);
if (mobileDefs.length) {
  parts.push("/* Responsive Typography — Mobile (≤768px) */");
  parts.push("@media (max-width: 768px) {");
  for (const def of mobileDefs) {
    parts.push(generateMobileOverride(def));
  }
  parts.push("}");
  parts.push("");
}

const output = parts.join("\n");
const outputPath = resolve(ROOT, "app/generated-typography.css");
writeFileSync(outputPath, output, "utf-8");

console.log(`\nGenerated ${definitions.length} typography utilities`);
console.log(`Output: ${outputPath}`);
