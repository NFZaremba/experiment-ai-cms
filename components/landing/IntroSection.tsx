"use client";

import { useRef, Fragment } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, SplitText } from "@/lib/gsap";
import { Text, SectionBadge, cn } from "@syscore/ui-library";
import { getLandingContent } from "@/lib/content";

const { intro } = getLandingContent();

function IntroSection({ className, ref, ...props }: React.ComponentPropsWithRef<"section">) {
  const containerRef = useRef<HTMLElement>(null);
  const resolvedRef = (ref as React.RefObject<HTMLElement>) || containerRef;

  useGSAP(
    () => {
      const paragraphs = gsap.utils.toArray<HTMLElement>(".intro-paragraph");

      paragraphs.forEach((el) => {
        const split = SplitText.create(el, { type: "words", aria: "none" });

        gsap.fromTo(
          split.words,
          { opacity: 0.25 },
          {
            opacity: 1,
            stagger: 0.02,
            scrollTrigger: {
              trigger: el,
              start: "top 85%",
              end: "top 35%",
              scrub: 1,
            },
          }
        );
      });
    },
    { scope: resolvedRef }
  );

  return (
    <section
      ref={resolvedRef}
      data-section="2"
      className={cn("py-12 sm:py-24", className)}
      {...props}
    >
      <div className="container-sm mx-auto text-center">
        <SectionBadge
          className="text-cyan-700 bg-[rgba(57,201,234,0.08)] border-cyan-700 mb-8"
          data-content-path="intro.badge"
        >
          {intro.badge}
        </SectionBadge>

        {/* Heading */}
        <Text as="h2" variant="heading-xlarge" className="mb-16 max-w-[698px] mx-auto">
          <span data-content-path="intro.title.line1">{intro.title.line1}</span>
          <br />
          <span
            data-content-path="intro.title.line2"
            className="pb-1 inline-block"
            style={{
              background:
                "linear-gradient(90deg, #383B44 0%, #383B40 13.46%, #375C4F 31.73%, #559C71 52.88%, #629A9B 71.15%, #266A86 100%)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {intro.title.line2}
          </span>
        </Text>

        {/* Paragraphs */}
        <div className="max-w-[696px] mx-auto flex flex-col gap-10">
          {intro.paragraphs.map((paragraph, i) => (
            <Text
              key={i}
              as="p"
              variant="heading-small"
              className={cn(
                "intro-paragraph text-gray-500 leading-9.5",
                i === 1 && "px-4"
              )}
            >
              {paragraph.map((segment, j) =>
                segment.highlight ? (
                  <span key={j} className="text-gray-800">
                    {segment.text}
                  </span>
                ) : (
                  <Fragment key={j}>{segment.text}</Fragment>
                )
              )}
            </Text>
          ))}
        </div>
      </div>
    </section>
  );
}

export { IntroSection };
