"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import { Button, Text, SectionBadge, Card, cn } from "@syscore/ui-library";
import { getLandingContent } from "@/lib/content";

const { roadmap } = getLandingContent();

interface Milestone {
  phase: string;
  status: "open" | "coming-soon";
  ctaVariant: "light" | "dark";
  statusText: string;
  title: string;
  description: string;
  cta: string | null;
  ctaHref: string;
}

const MILESTONES: Milestone[] = roadmap.milestones.map((m) => ({
  phase: m.phase,
  status: m.status,
  ctaVariant: m.ctaVariant,
  statusText: m.statusText,
  title: m.title,
  description: m.description,
  cta: m.cta,
  ctaHref: m.ctaHref,
}));

function MilestoneCard({
  milestone,
  align,
  className,
  path,
}: {
  milestone: Milestone;
  align: "left" | "right";
  className?: string;
  path?: string;
}) {
  const isOpen = milestone.status === "open";
  const isLightCta = milestone.ctaVariant === "light";

  return (
    <Card
      className={cn(
        "milestone-card rounded-2xl border-transparent bg-black/20 p-8 pr-16 max-w-[680px] transition-colors duration-300 hover:border-gray-500",
        align === "left" ? "md:ml-auto" : "md:mr-auto",
        className
      )}
    >
      <div className="milestone-card-body flex flex-col items-start gap-8">
        <div className="flex items-center gap-4">
          <SectionBadge
            className={cn(
              "mb-0 border-2 bg-transparent",
              isOpen ? "border-emerald-500 text-white" : "border-gray-700 text-white"
            )}
          >
            {milestone.phase}
          </SectionBadge>

          <Text
            as="p"
            variant="body-base"
            className={cn("italic", isOpen ? "text-emerald-300" : "text-gray-400")}
            data-content-path={path ? `${path}.statusText` : undefined}
          >
            {milestone.statusText}
          </Text>
        </div>

        <Text as="h3" variant="heading-small" className="text-white" data-content-path={path ? `${path}.title` : undefined}>
          {milestone.title}
        </Text>

        <Text as="p" variant="body-large" className="text-gray-300" data-content-path={path ? `${path}.description` : undefined}>
          {milestone.description}
        </Text>

        {milestone.cta && (
          <Link href={milestone.ctaHref} target="_blank" rel="noopener noreferrer">
            <Button
              variant={"clear"}
              size="large"
              className={cn(
                "transition-transform duration-200 ease-in-out origin-center hover:scale-[1.02]",
                !isLightCta ? "text-white bg-white/8" : "text-cyan-800 bg-white"
              )}
              data-content-path={path ? `${path}.cta` : undefined}
            >
              {milestone.cta}
            </Button>
          </Link>
        )}
      </div>
    </Card>
  );
}

function RoadmapSection({ className, ref, ...props }: React.ComponentPropsWithRef<"section">) {
  const containerRef = useRef<HTMLElement>(null);
  const resolvedRef = (ref as React.RefObject<HTMLElement>) || containerRef;
  const timelineRef = useRef<HTMLDivElement>(null);
  const [timelineHeight, setTimelineHeight] = useState(1482);

  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setTimelineHeight(entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useGSAP(
    () => {
      const capPath = resolvedRef.current?.querySelector(
        "#roadmap-timeline-path-1"
      ) as SVGPathElement | null;
      const linePath = resolvedRef.current?.querySelector(
        "#roadmap-timeline-path-2"
      ) as SVGPathElement | null;
      const cards = gsap.utils.toArray<HTMLElement>(".milestone-card");

      // Hide card content initially
      const cardBodies = cards.map((card) => card.querySelector(".milestone-card-body"));
      gsap.set(cardBodies, { opacity: 0 });

      // Prepare SVG paths for draw animation
      [capPath, linePath].forEach((path) => {
        if (path) {
          const length = path.getTotalLength();
          gsap.set(path, {
            strokeDasharray: length,
            strokeDashoffset: length,
          });
        }
      });

      // Timeline plays on enter, reverses on leave
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: resolvedRef.current,
          start: "top 60%",
          toggleActions: "play play play reverse",
        },
      });

      // Phase 1: Draw the horizontal cap
      if (capPath) {
        tl.to(capPath, { strokeDashoffset: 0, duration: 0.4, ease: "power2.out" });
      }

      // Phase 2: Draw the vertical line top-to-bottom
      if (linePath) {
        tl.to(linePath, { strokeDashoffset: 0, duration: 0.8, ease: "power1.inOut" });
      }

      // Phase 3: ClipPath reveals card, then body fades in
      cards.forEach((card, i) => {
        const isLeft = i % 2 === 0;
        const body = card.querySelector(".milestone-card-body");

        const cardTl = gsap.timeline({
          scrollTrigger: {
            trigger: card,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
        });

        cardTl.fromTo(
          card,
          { clipPath: isLeft ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)" },
          {
            clipPath: isLeft ? "inset(0 0 0 0%)" : "inset(0 0% 0 0)",
            duration: 0.6,
            ease: "power2.out",
          }
        );

        if (body) {
          cardTl.fromTo(
            body,
            { opacity: 0, y: 10 },
            { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" },
            "<+=0.2"
          );
        }
      });
    },
    { scope: resolvedRef, dependencies: [timelineHeight] }
  );

  return (
    <section
      ref={resolvedRef}
      data-section="7"
      className={cn("bg-[#212638] pt-12 sm:pt-24", className)}
      {...props}
    >
      <div className="container-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-18">
          <SectionBadge className="text-bronze-300 bg-[rgba(0,0,0,0.20)]" data-content-path="roadmap.badge">
            {roadmap.badge}
          </SectionBadge>

          <Text as="h2" variant="heading-xlarge" className="mb-12">
            <span
              data-content-path="roadmap.title.highlight"
              style={{
                background:
                  "radial-gradient(54.34% 86.92% at 60.24% 90.33%, #16ADCF 0%, #1DD7B2 100%)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {roadmap.title.highlight}
            </span>{" "}
            <span className="text-white" data-content-path="roadmap.title.suffix">{roadmap.title.suffix}</span>
          </Text>

          <Text as="p" variant="body-large" className="text-white max-w-[640px] mx-auto" data-content-path="roadmap.intro">
            {roadmap.intro}
          </Text>
        </div>

        {/* Timeline */}
        <div ref={timelineRef} className="relative ">
          {/* Center vertical line with cap (desktop only) */}
          <div className="hidden md:block absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-[109px] overflow-visible z-10">
            <svg
              className="h-full w-full"
              viewBox={`0 0 109 ${timelineHeight}`}
              fill="none"
              preserveAspectRatio="none"
            >
              <path
                id="roadmap-timeline-path-1"
                d="M107 2L2 2"
                stroke="#F3E7D8"
                strokeWidth="4"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                id="roadmap-timeline-path-2"
                d={`M54.5 2L54.5 ${timelineHeight}`}
                stroke="#F3E7D8"
                strokeWidth="4"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>

          {/* Milestone cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_80px_1fr] gap-y-8 md:gap-y-0 pt-18 pb-32">
            {MILESTONES.map((milestone, index) => {
              const isLeft = index % 2 === 0;

              return (
                <div
                  key={milestone.phase}
                  style={{ gridRow: index + 1 }}
                  className={cn(isLeft ? "md:col-start-1 md:-mr-10" : "md:col-start-3 md:-ml-10")}
                >
                  <MilestoneCard
                    milestone={milestone}
                    align={isLeft ? "left" : "right"}
                    className={cn(isLeft ? "md:rounded-r-none" : "md:rounded-l-none")}
                    path={`roadmap.milestones.${index}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export { RoadmapSection };
