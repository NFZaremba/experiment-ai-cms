"use client";

import Image from "next/image";
import { Text, cn } from "@syscore/ui-library";
import { getPage2Content } from "@/lib/content";
import { LayoutChip } from "@/components/studio/LayoutChip";
import { useLayoutValue } from "@/lib/studio/use-edit-mode";

const page = getPage2Content();
const PAGE = "page-2";

/**
 * Minimal second page — the multi-page test fixture AND the demo surface for
 * constrained AI layout edits. The `feature` (image+text) and `cards` blocks
 * read their layout from a constrained vocabulary (see lib/content/layout-vocab.ts);
 * in edit mode a "✦ Layout" chip opens the panel's controls + AI box. Variants
 * re-render live via the draft store (useLayoutValue) — no reload.
 */
export default function Page2() {
  // Layout values — live from the draft store in edit mode, else static content.
  const imagePosition = useLayoutValue(PAGE, "feature.imagePosition", page.feature.imagePosition);
  const cardsLayout = useLayoutValue(PAGE, "cards.layout", page.cards.layout);

  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <Text as="h1" variant="heading-xlarge" data-content-path="title">
        {page.title}
      </Text>
      <Text as="p" variant="body-large" className="mt-4 text-gray-600" data-content-path="intro">
        {page.intro}
      </Text>

      <div className="mt-14 flex flex-col gap-10">
        {page.sections.map((s, i) => (
          <section key={i}>
            <Text as="h2" variant="heading-large" data-content-path={`sections.${i}.heading`}>
              {s.heading}
            </Text>
            <Text
              as="p"
              variant="body-large"
              className="mt-2 text-gray-600"
              data-content-path={`sections.${i}.body`}
            >
              {s.body}
            </Text>
          </section>
        ))}
      </div>

      {/* Image + text block — sides swap on `imagePosition`. */}
      <section className="relative mt-20">
        <LayoutChip path="feature.imagePosition" value={imagePosition} label="Image position" />
        <div
          className={cn(
            "flex items-center gap-8",
            imagePosition === "stacked" ? "flex-col" : "flex-col md:flex-row",
            imagePosition === "left" && "md:flex-row-reverse"
          )}
        >
          <div className="flex-1">
            <Text as="h2" variant="heading-large" data-content-path="feature.heading">
              {page.feature.heading}
            </Text>
            <Text
              as="p"
              variant="body-large"
              className="mt-3 text-gray-600"
              data-content-path="feature.body"
            >
              {page.feature.body}
            </Text>
          </div>
          <div className="relative aspect-[4/3] w-full flex-1 overflow-hidden rounded-lg bg-gray-100">
            <Image
              src={page.feature.image.src}
              alt={page.feature.image.alt}
              data-content-path="feature.image"
              data-field-type="image"
              data-src={page.feature.image.src}
              fill
              sizes="(max-width: 768px) 100vw, 384px"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* Card collection — arrangement changes on `layout`. */}
      <section className="relative mt-20">
        <LayoutChip path="cards.layout" value={cardsLayout} label="Layout" />
        <div
          className={cn(
            cardsLayout === "grid" && "grid grid-cols-1 gap-4 sm:grid-cols-3",
            cardsLayout === "cards" && "grid grid-cols-1 gap-6 sm:grid-cols-2",
            cardsLayout === "rows" && "flex flex-col gap-3"
          )}
        >
          {page.cards.items.map((c, i) => (
            <div
              key={i}
              className={cn(
                "rounded-lg border border-gray-200 p-5",
                cardsLayout === "cards" && "shadow-md",
                cardsLayout === "rows" && "flex items-baseline gap-4"
              )}
            >
              <Text
                as="h3"
                variant="body-large"
                className={cn("font-semibold", cardsLayout === "rows" && "min-w-32 shrink-0")}
                data-content-path={`cards.items.${i}.title`}
              >
                {c.title}
              </Text>
              <Text
                as="p"
                variant="body-small"
                className="mt-1 text-gray-600"
                data-content-path={`cards.items.${i}.body`}
              >
                {c.body}
              </Text>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
