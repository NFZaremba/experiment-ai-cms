"use client";

import { cn } from "@syscore/ui-library";
import { EditableText } from "@/components/studio/EditableText";
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
        <EditableText
          as="p"
          variant="body-small"
          className="font-semibold uppercase tracking-[0.18em] text-white/80"
          path="sum.eyebrow"
        >
          {sum.eyebrow}
        </EditableText>
        <EditableText as="h2" variant="heading-large" className="max-w-3xl text-white" path="sum.heading">
          {sum.heading}
        </EditableText>
        <EditableText as="p" variant="body-large" className="max-w-2xl text-white/85" path="sum.body">
          {sum.body}
        </EditableText>
      </div>
    </section>
  );
}
