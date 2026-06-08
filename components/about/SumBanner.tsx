"use client";

import { Text, cn } from "@syscore/ui-library";
import { getAboutContent } from "@/lib/content";
import { LayoutChip } from "@/components/studio/LayoutChip";
import { useLayoutValue } from "@/lib/studio/use-edit-mode";

const { sum } = getAboutContent();
const PAGE = "about";

/** Full-bleed "We are more than the sum of our parts" banner over an on-brand
 *  gradient. Text alignment is the AI-editable layout variant (left | center). */
export function SumBanner() {
  const textAlign = useLayoutValue(PAGE, "sum.textAlign", sum.textAlign);

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "var(--gradient-primary)" }}
    >
      <LayoutChip path="sum.textAlign" value={textAlign} label="Text alignment" />
      <div
        className={cn(
          "container-lg mx-auto flex flex-col gap-5 py-28",
          textAlign === "center" ? "items-center text-center" : "items-start text-left"
        )}
      >
        <Text
          as="p"
          variant="body-small"
          className="font-semibold uppercase tracking-[0.18em] text-white/80"
          data-content-path="sum.eyebrow"
        >
          {sum.eyebrow}
        </Text>
        <Text as="h2" variant="heading-large" className="max-w-3xl text-white" data-content-path="sum.heading">
          {sum.heading}
        </Text>
        <Text as="p" variant="body-large" className="max-w-2xl text-white/85" data-content-path="sum.body">
          {sum.body}
        </Text>
      </div>
    </section>
  );
}
