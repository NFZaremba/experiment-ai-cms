"use client";

import { cn } from "@syscore/ui-library";
import { getAboutContent } from "@/lib/content";
import { LayoutChip } from "@/components/studio/LayoutChip";
import { EditableText } from "@/components/studio/EditableText";
import { useLayoutValue } from "@/lib/studio/use-edit-mode";

const { hero } = getAboutContent();
const PAGE = "about";

/** Dark hero band — "About us / People-First Places". Heading alignment is an
 *  AI-editable layout variant (center | left). Decorative circles echo the
 *  source page's circular-photo motif without needing real imagery. */
export function AboutHero() {
  const textAlign = useLayoutValue(PAGE, "hero.textAlign", hero.textAlign);

  return (
    <section className="relative overflow-hidden bg-cyan-900">
      <LayoutChip path="hero.textAlign" value={textAlign} label="Heading alignment" />

      {/* Decorative brand-color circles */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-10 h-64 w-64 rounded-full bg-cyan-300/20 blur-2xl" />
        <div className="absolute -top-10 right-10 h-72 w-72 rounded-full bg-emerald-300/20 blur-2xl" />
        <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-bronze-300/15 blur-2xl" />
      </div>

      <div
        className={cn(
          "container-sm mx-auto relative z-10 flex flex-col gap-6 py-28 sm:py-36",
          textAlign === "center" ? "items-center text-center" : "items-start text-left"
        )}
      >
        <EditableText
          as="p"
          variant="body-small"
          className="font-semibold uppercase tracking-[0.18em] text-bronze-300"
          path="hero.eyebrow"
        >
          {hero.eyebrow}
        </EditableText>
        <EditableText as="h1" variant="heading-xlarge" className="text-white" path="hero.title">
          {hero.title}
        </EditableText>
        <EditableText
          as="p"
          variant="body-large"
          className="max-w-2xl text-white/80"
          path="hero.subtitle"
        >
          {hero.subtitle}
        </EditableText>
      </div>
    </section>
  );
}
