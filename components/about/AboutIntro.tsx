"use client";

import { cn } from "@syscore/ui-library";
import { getAboutContent } from "@/lib/content";
import { LayoutChip } from "@/components/studio/LayoutChip";
import { EditableText } from "@/components/studio/EditableText";
import { useLayoutValue } from "@/lib/studio/use-edit-mode";

const { intro } = getAboutContent();
const PAGE = "about";

/** Intro prose. Column count is an AI-editable layout variant (one | two) —
 *  driven via CSS multi-column so each paragraph stays independently editable. */
export function AboutIntro() {
  const columns = useLayoutValue(PAGE, "intro.columns", intro.columns);

  return (
    <section className="relative bg-gray-50 py-16 sm:py-24">
      <LayoutChip path="intro.columns" value={columns} label="Text columns" />
      <div
        className={cn(
          "container-sm mx-auto",
          columns === "two" ? "sm:columns-2 sm:gap-12" : "max-w-2xl"
        )}
      >
        {intro.paragraphs.map((p, i) => (
          <EditableText
            key={i}
            as="p"
            variant="body-large"
            className="mb-5 break-inside-avoid text-gray-700"
            path={`intro.paragraphs.${i}`}
          >
            {p}
          </EditableText>
        ))}
      </div>
    </section>
  );
}
