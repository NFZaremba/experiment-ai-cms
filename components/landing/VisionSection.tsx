"use client";

import React, { Fragment, useRef } from "react";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import { gsap, SplitText, ScrollTrigger } from "@/lib/gsap";
import { Text, SectionBadge, cn } from "@syscore/ui-library";
import { getLandingContent } from "@/lib/content";

const { vision } = getLandingContent();

function VisionSection({ className, ref, ...props }: React.ComponentPropsWithRef<"div">) {
  const containerRef = useRef<HTMLDivElement>(null);
  const resolvedRef = (ref as React.RefObject<HTMLDivElement>) || containerRef;
  const capsuleRef = useRef<HTMLDivElement>(null);
  const circleRef = useRef<HTMLDivElement>(null);
  const capsuleWrapperRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // Word-by-word reveal — shared between mobile and desktop
      const visionParagraphs = gsap.utils.toArray<HTMLElement>(".vision-paragraph");
      visionParagraphs.forEach((el) => {
        const split = SplitText.create(el, { type: "words", aria: "none" });
        gsap.fromTo(
          split.words,
          { opacity: 0.05 },
          {
            opacity: 1,
            stagger: 0.02,
            scrollTrigger: {
              trigger: el,
              start: "top 85%",
              end: "top 15%",
              scrub: 1,
            },
          }
        );
      });

      const mm = gsap.matchMedia();

      mm.add("(min-width: 768px)", () => {
        // Fade out all sticky statements as they scroll away
        const stickyEls = gsap.utils.toArray<HTMLElement>(".sticky-statement");

        stickyEls.forEach((el) => {
          gsap
            .timeline({
              scrollTrigger: {
                trigger: el,
                start: "bottom 70%",
                end: "bottom 15%",
                scrub: 0.5,
              },
            })
            .to(el, { opacity: 0, yPercent: -10 });
        });

        // Size capsule: from its top offset to the circle's bottom edge
        const sizeCapsule = () => {
          const capsule = capsuleRef.current;
          const wrapper = capsuleWrapperRef.current;
          const circle = circleRef.current;
          if (!capsule || !wrapper || !circle) return;

          const experienceSection = wrapper.querySelector(".sticky-statement") as HTMLElement;
          if (!experienceSection) return;

          const expHeight = experienceSection.offsetHeight;
          const stickyHeight = window.innerHeight; // h-screen
          const circleHeight = circle.offsetHeight;
          // Circle is flex-centered in the h-screen sticky container
          const circleBottom = expHeight + stickyHeight / 2 + circleHeight / 2;
          // Capsule starts at top: -11vh, so add that offset
          const topOffsetPx = window.innerHeight * 0.11;
          capsule.style.height = `${circleBottom + topOffsetPx}px`;
        };

        sizeCapsule();
        ScrollTrigger.addEventListener("refreshInit", sizeCapsule);

        // Circle — expands as you scroll through the zone
        gsap.to(".vision-circle-expand", {
          scale: 8,
          scrollTrigger: {
            trigger: ".vision-well-zone",
            start: "top 20%",
            end: "40% top",
            scrub: 1,
          },
        });

        // Body text — fades in container after circle starts expanding
        gsap.set(".vision-body-text", { opacity: 0, y: 40 });
        gsap.to(".vision-body-text", {
          opacity: 1,
          y: 0,
          scrollTrigger: {
            trigger: ".vision-well-zone",
            start: "5% top",
            end: "25% top",
            scrub: 1,
          },
        });

        // Dark bg — fades out as circle fills the viewport
        gsap.to(resolvedRef.current, {
          backgroundColor: "transparent",
          scrollTrigger: {
            trigger: ".vision-well-zone",
            start: "30% top",
            end: "60% top",
            scrub: 1,
          },
        });

        return () => ScrollTrigger.removeEventListener("refreshInit", sizeCapsule);
      });
    },
    { scope: resolvedRef }
  );

  return (
    <div
      ref={resolvedRef}
      data-section="5"
      className={cn(
        "relative bg-gray-900 py-24 overflow-clip flex flex-col items-center justify-center",
        className
      )}
      {...props}
    >
      <SectionBadge className="text-plum-400 bg-[rgba(99,62,90,0.20)]" data-content-path="vision.badge">{vision.badge}</SectionBadge>

      {/* Mobile: single block with word-by-word reveal */}
      <div className="md:hidden text-center px-6 mt-8">
        <Text as="h2" variant="heading-xlarge" className="vision-paragraph text-white mb-16" data-content-path="vision.tagline">
          {vision.tagline}
        </Text>

        {vision.paragraphs.map((paragraph, i) => (
          <Text
            key={i}
            as="p"
            variant="heading-small"
            className={cn(
              "vision-paragraph text-gray-400 leading-9.5",
              i < vision.paragraphs.length - 1 && "mb-12"
            )}
          >
            {paragraph.map((segment, j) =>
              segment.highlight ? (
                <span key={j} className="text-white">
                  {segment.text}
                </span>
              ) : (
                <Fragment key={j}>{segment.text}</Fragment>
              )
            )}
          </Text>
        ))}
      </div>

      {/* Desktop: sticky scroll + circle expansion */}
      <div className="hidden md:contents">
        {/* "One standard" */}
        <div className="sticky-statement" style={{ minHeight: "50vh" }}>
          <Text
            as="h2"
            variant="heading-xlarge"
            className="text-white text-center"
            style={{ top: "20vh", position: "sticky" }}
            data-content-path="vision.stickyStatements.0"
          >
            {vision.stickyStatements[0]}
          </Text>
        </div>

        {/* Capsule wrapper — "One experience" through "One WELL" */}
        <div ref={capsuleWrapperRef} className="relative">
          {/* Capsule shape — gradient image */}
          <div
            ref={capsuleRef}
            className="vision-capsule absolute left-1/2 -translate-x-1/2 w-[350px] md:w-[600px] pointer-events-none overflow-hidden"
            style={{
              zIndex: 0,
              top: "-11vh",
              borderRadius: "9999px",
            }}
          >
            <Image
              src="/img/shapes.webp"
              alt=""
              fill
              sizes="(max-width: 768px) 350px, 600px"
              style={{ objectFit: "cover", objectPosition: "center" }}
              className="select-none pointer-events-none"
            />
          </div>

          {/* "One experience" */}
          <div className="sticky-statement relative" style={{ minHeight: "50vh", zIndex: 1 }}>
            <Text
              as="h2"
              variant="heading-xlarge"
              className="text-white text-center pt-32"
              style={{ top: "20vh", position: "sticky" }}
              data-content-path="vision.stickyStatements.1"
            >
              {vision.stickyStatements[1]}
            </Text>
          </div>

          {/* "One WELL" zone — circle is sticky behind, text + body scroll normally */}
          <div className="vision-well-zone relative" style={{ minHeight: "110vh", zIndex: 1 }}>
            {/* Circle — sticky, stays centered, expands behind scrolling content */}
            <div
              className="sticky top-0 h-screen flex items-center justify-center pointer-events-none"
              style={{ zIndex: 0 }}
            >
              <div
                ref={circleRef}
                className="vision-circle-expand w-[300px] h-[300px] md:w-[600px] md:h-[600px] bg-white"
                style={{
                  borderRadius: "50%",
                  boxShadow: "0 0 80px 20px rgba(255, 255, 255, 0.4)",
                  willChange: "transform",
                }}
              />
            </div>

            {/* Content — scrolls normally over the circle */}
            <div className="relative" style={{ zIndex: 1, marginTop: "-50vh" }}>
              <Text as="h2" variant="heading-xlarge" className="text-gray-800 text-center" data-content-path="vision.stickyStatements.2">
                {vision.stickyStatements[2]}
              </Text>

              {/* Body text */}
              <div className="vision-body-text text-center max-w-[936px] mx-auto pt-12">
                {vision.paragraphs.map((paragraph, i) => (
                  <Text
                    key={i}
                    as="p"
                    variant="heading-small"
                    className={cn(
                      "vision-paragraph text-gray-500 leading-9.5",
                      i < vision.paragraphs.length - 1 && "mb-12"
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
          </div>
        </div>
      </div>
    </div>
  );
}

export { VisionSection };
