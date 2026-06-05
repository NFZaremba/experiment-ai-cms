"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import { Button, Text, SectionBadge, cn } from "@syscore/ui-library";
import { MessageSquare } from "lucide-react";
import { getLandingContent } from "@/lib/content";
import { FEEDBACK_ENABLED } from "@/lib/feature-flags";

const { feedback } = getLandingContent();

// Standalone marketing build: no auth. Feedback CTA links out to the public site.
const FEEDBACK_URL = "https://www.wellcertified.com";

const FeedbackIcon = (
  <MessageSquare className="w-5 text-white mr-4 fill-[rgba(161,192,169,0.2)] stroke-[#458EAB]" />
);

function FeedbackSection({ className, ref, ...props }: React.ComponentPropsWithRef<"section">) {
  if (!FEEDBACK_ENABLED) return null;
  const containerRef = useRef<HTMLElement>(null);
  const resolvedRef = (ref as React.RefObject<HTMLElement>) || containerRef;

  const [sphereLoaded, setSphereLoaded] = useState(false);

  useGSAP(
    () => {
      if (!sphereLoaded) return;

      // Desktop-only — skip animations on mobile/tablet.
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px)", () => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: resolvedRef.current,
            start: "top 95%",
            toggleActions: "play none none reverse",
          },
        });

        // Reveal sphere from center top with expanding circle mask
        tl.fromTo(
          ".feedback-sphere",
          { clipPath: "circle(0% at 50% 0%)" },
          { clipPath: "circle(150% at 50% 0%)", duration: 2, ease: "power2.out" },
          0
        )
          .fromTo(
            ".feedback-heading",
            { opacity: 0, y: 30 },
            { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" },
            "<+=0.2"
          )
          .fromTo(
            ".feedback-body",
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" },
            "<+=0.2"
          )
          .fromTo(
            ".feedback-cta",
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" },
            "<+=0.2"
          );
      });
    },
    { scope: resolvedRef, dependencies: [sphereLoaded], revertOnUpdate: true }
  );

  return (
    <section
      ref={resolvedRef}
      data-section="8"
      {...props}
      className={cn(
        "relative min-h-[640px] overflow-hidden bg-[#212638] flex flex-col items-center justify-center",
        className
      )}
    >
      {/* Background circle image */}
      <div className="feedback-sphere absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none w-[1200px] mx-auto">
        <Image
          src="/img/sphere.webp"
          alt=""
          width={1200}
          height={640}
          onLoad={() => setSphereLoaded(true)}
          sizes="(min-width: 1200px) 1200px, 100vw"
          className="h-auto object-contain"
        />
      </div>

      {/* Content */}
      <div className="container-lg mx-auto relative z-10 pt-28  pb-24">
        <div className="text-center flex flex-col items-center">
          <SectionBadge className="text-bronze-300 bg-[rgba(255,255,250,.08)]" data-content-path="feedback.badge">
            {feedback.badge}
          </SectionBadge>

          <Text as="h2" variant="heading-xlarge" className="feedback-heading text-white mb-12" data-content-path="feedback.title">
            {feedback.title}
          </Text>

          <Text as="p" variant="body-large" className="feedback-body text-white mx-auto mb-12" data-content-path="feedback.body">
            {feedback.body}
          </Text>

          <div className="feedback-cta">
            <Button
              variant="secondary-light"
              size="xlarge"
              className="shadow-2xl"
              onClick={() => window.open(FEEDBACK_URL, "_blank", "noopener")}
              data-content-path="feedback.ctaAuthed"
            >
              {FeedbackIcon} {feedback.ctaAuthed}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export { FeedbackSection };
