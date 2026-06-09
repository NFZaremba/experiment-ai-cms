"use client";

import { cn } from "@syscore/ui-library";
import { EditableText } from "@/components/studio/EditableText";
import { getAboutContent } from "@/lib/content";
import { LayoutChip } from "@/components/studio/LayoutChip";
import { useLayoutValue } from "@/lib/studio/use-edit-mode";

const { stats } = getAboutContent();
const PAGE = "about";

/** Dark stats band. Arrangement is the AI-editable layout variant
 *  (row | grid). */
export function StatsBand() {
  const layout = useLayoutValue(PAGE, "stats.layout", stats.layout);

  return (
    <section className="relative bg-[#0a5161] py-16">
      <LayoutChip path="stats.layout" value={layout} label="Layout" />
      <div
        className={cn(
          "container-lg mx-auto",
          layout === "grid"
            ? "grid grid-cols-2 gap-10 sm:grid-cols-4"
            : "flex flex-col gap-10 sm:flex-row sm:flex-wrap sm:justify-between"
        )}
      >
        {stats.items.map((s, i) => (
          <div key={i} className="flex flex-col gap-1 sm:max-w-[12rem]">
            <EditableText as="p" variant="heading-small" className="text-white" path={`stats.items.${i}.value`}>
              {s.value}
            </EditableText>
            <EditableText as="p" variant="body-small" className="text-white/70" path={`stats.items.${i}.label`}>
              {s.label}
            </EditableText>
          </div>
        ))}
      </div>
    </section>
  );
}
