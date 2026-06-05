"use client";

import React, { useRef, useState, useCallback, useEffect, useLayoutEffect } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, Flip, ScrollTrigger } from "@/lib/gsap";
import { Text, Card, cn } from "@syscore/ui-library";
import { getLandingContent } from "@/lib/content";

interface Feature {
  title: string;
  description: string;
  descriptionMaxWidth: number;
  video: string;
  textColor: string;
  path: string;
}

/**
 * Presentation for each feature card — video asset, text color, and the
 * max width of the description box. Merged by index with copy from
 * `getLandingContent().features.items`.
 */
const FEATURE_PRESENTATION = [
  { descriptionMaxWidth: 506, video: "/videos/feature1-new.mp4", textColor: "text-gray-800" },
  { descriptionMaxWidth: 506, video: "/videos/feature2-new.mp4", textColor: "text-white" },
  { descriptionMaxWidth: 312, video: "/videos/feature3-new.mp4", textColor: "text-gray-800" },
  { descriptionMaxWidth: 489, video: "/videos/feature4-new.mp4", textColor: "text-white" },
] as const;

const FEATURES: Feature[] = getLandingContent().features.items.map((item, i) => ({
  title: item.title,
  description: item.description,
  path: `features.items.${i}`,
  ...FEATURE_PRESENTATION[i],
}));

function FeatureGridCard({
  feature,
  isActive,
  activeInRow,
  onClick,
  textColor,
}: {
  feature: Feature;
  isActive: boolean;
  activeInRow: boolean;
  onClick: () => void;
  textColor: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const idleTitleRef = useRef<HTMLDivElement>(null);
  const activeContentRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLDivElement>(null);

  // Crossfade titles, overlay + description
  useEffect(() => {
    const idleTitle = idleTitleRef.current;
    const activeContent = activeContentRef.current;
    const desc = descRef.current;
    const overlay = overlayRef.current;

    if (overlay) {
      gsap.killTweensOf(overlay);
      gsap.to(
        overlay,
        isActive ? { opacity: 0, duration: 0.3 } : { opacity: 1, duration: 0.3, delay: 0.1 }
      );
    }

    // Crossfade idle title ↔ active content with vertical slide
    if (idleTitle) {
      gsap.killTweensOf(idleTitle);
      gsap.to(
        idleTitle,
        isActive
          ? { opacity: 0, y: -12, duration: 0.25 }
          : { opacity: 1, y: 0, duration: 0.3, delay: 0.15 }
      );
    }

    if (activeContent) {
      gsap.killTweensOf(activeContent);
      gsap.to(
        activeContent,
        isActive
          ? { opacity: 1, y: 0, duration: 0.3, delay: 0.2 }
          : { opacity: 0, y: 16, duration: 0.2 }
      );
    }

    // Description slides up right after active title
    if (!isActive && desc) {
      gsap.killTweensOf(desc);
      gsap.set(desc, { opacity: 0, y: 12 });
    }

    if (isActive && desc) {
      gsap.set(desc, { opacity: 0, y: 12 });
      gsap.to(desc, { opacity: 1, y: 0, duration: 0.3, delay: 0.3 });
    }
  }, [isActive]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!isActive) {
      video.pause();
      return;
    }

    video.currentTime = 0;
    video.play().catch(() => {});
  }, [isActive]);

  return (
    <Card
      onClick={onClick}
      className="feature-grid-card relative overflow-hidden cursor-pointer p-12 bg-white shadow-[0_4px_24px_rgba(16,24,40,0.06)] hover:shadow-[0_8px_24px_rgba(16,24,40,0.12)] transition-shadow duration-300 rounded-3xl"
      style={{
        flex: isActive ? 7 : activeInRow ? 3 : 1,
        aspectRatio: isActive ? "16/9" : undefined,
        height: isActive ? undefined : activeInRow ? undefined : 240,
      }}
    >
      {/* Video background */}
      <video
        ref={videoRef}
        src={feature.video}
        muted
        playsInline
        preload="metadata"
        className="absolute bottom-0 left-0 w-full h-full object-cover transition-[opacity,transform] ease-out"
        style={{
          opacity: isActive ? 1 : 0,
          transform: `scale(${isActive ? 1.02 : 1.4})`,
          transitionDuration: isActive ? "500ms" : "350ms",
        }}
      />

      {/* White overlay */}
      <div ref={overlayRef} className="absolute inset-0 z-10 bg-white" />

      {/* Idle title — centered */}
      <div ref={idleTitleRef} className="absolute inset-0 z-20 flex items-center justify-center">
        <Text as="h2" variant="heading-large" className="text-gray-500" data-content-path={`${feature.path}.title`}>
          {feature.title}
        </Text>
      </div>

      {/* Active content — title + description at top-left */}
      <div ref={activeContentRef} className="absolute z-20" style={{ opacity: 0 }}>
        <Text as="h2" variant="heading-large" className={textColor} data-content-path={`${feature.path}.title`}>
          {feature.title}
        </Text>
        <div ref={descRef} className="pt-8" style={{ opacity: 0 }}>
          <Text
            as="p"
            variant="body-large"
            className={cn("whitespace-pre-line", textColor)}
            style={{ maxWidth: feature.descriptionMaxWidth }}
            data-content-path={`${feature.path}.description`}
          >
            {feature.description}
          </Text>
        </div>
      </div>
    </Card>
  );
}

function FeaturesGridMobile() {
  return (
    <div className="grid gap-8 lg:hidden grid-cols-1 md:grid-cols-2">
      {FEATURES.map((feature) => (
        <Card
          key={feature.title}
          className="relative overflow-hidden bg-white p-12 shadow-[0_4px_24px_rgba(16,24,40,0.06)] rounded-3xl"
        >
          <Text as="h2" variant="heading-large" className="mb-8" data-content-path={`${feature.path}.title`}>
            {feature.title}
          </Text>
          <Text as="p" variant="body-large" data-content-path={`${feature.path}.description`}>
            {feature.description}
          </Text>
        </Card>
      ))}
    </div>
  );
}

const FEATURE_ROWS = [FEATURES.slice(0, 2), FEATURES.slice(2, 4)];

function FeaturesGrid() {
  const [activeIndex, setActiveIndex] = useState<number | null>(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const flipStateRef = useRef<ReturnType<typeof Flip.getState> | null>(null);

  const handleClick = useCallback((index: number) => {
    if (gridRef.current) {
      // Lock container height before Flip so content below doesn't shift
      gridRef.current.style.height = `${gridRef.current.offsetHeight}px`;
      flipStateRef.current = Flip.getState(
        gridRef.current.querySelectorAll(".feature-grid-card, .feature-grid-row")
      );
    }
    setActiveIndex((prev) => (prev === index ? null : index));
  }, []);

  useLayoutEffect(() => {
    if (!flipStateRef.current || !gridRef.current) return;
    const container = gridRef.current;
    // Temporarily clear locked height to measure true natural size
    const lockedHeight = container.style.height;
    container.style.height = "";
    const targetHeight = container.scrollHeight;
    container.style.height = lockedHeight;

    Flip.from(flipStateRef.current, {
      absolute: true,
      nested: true,
      duration: 0.5,
      ease: "power2.inOut",
      onStart: () => {
        // Animate container height to new value
        gsap.to(container, {
          height: targetHeight,
          duration: 0.5,
          ease: "power2.inOut",
        });
      },
      onComplete: () => {
        container.style.height = "";
        ScrollTrigger.refresh();
      },
    });
    flipStateRef.current = null;
  }, [activeIndex]);

  return (
    <div
      ref={gridRef}
      className="feature-grid-container w-full mx-auto hidden lg:flex flex-col gap-12"
      style={{ maxWidth: 1280 }}
    >
      {FEATURE_ROWS.map((row, rowIndex) => {
        const rowStart = rowIndex * 2;
        const activeInRow =
          activeIndex !== null && activeIndex >= rowStart && activeIndex < rowStart + 2;

        return (
          <div key={rowIndex} className="feature-grid-row flex gap-12">
            {row.map((feature, colIndex) => {
              const index = rowStart + colIndex;
              return (
                <FeatureGridCard
                  key={feature.title}
                  feature={feature}
                  isActive={activeIndex === index}
                  activeInRow={activeInRow}
                  onClick={() => handleClick(index)}
                  textColor={feature.textColor}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function FeaturesSection({ className, ref, ...props }: React.ComponentPropsWithRef<"section">) {
  const containerRef = useRef<HTMLElement>(null);
  const resolvedRef = (ref as React.RefObject<HTMLElement>) || containerRef;

  useGSAP(
    () => {
      const grid = resolvedRef.current?.querySelector(".feature-grid-container");
      if (!grid) return;

      gsap.fromTo(
        grid,
        { opacity: 0, y: 60 },
        {
          opacity: 1,
          y: 0,
          scrollTrigger: {
            trigger: grid,
            start: "top 85%",
            end: "top 50%",
            scrub: 1,
          },
        }
      );
    },
    { scope: resolvedRef }
  );

  return (
    <section
      ref={resolvedRef}
      data-section="3"
      className={cn("py-12 sm:py-24", className)}
      {...props}
    >
      <div className="container-lg mx-auto flex flex-col gap-16 md:gap-24">
        <FeaturesGridMobile />
        <FeaturesGrid />
      </div>
    </section>
  );
}

export { FeaturesSection };
