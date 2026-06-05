"use client";

import React, { useRef, useState, useCallback, useMemo, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLenis } from "lenis/react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import { Text, SectionBadge, Button, cn } from "@syscore/ui-library";
import { YouTubePlayer, type YouTubePlayerHandle } from "@/components/ui/youtube-player";
import { getLandingContent } from "@/lib/content";

const { tour } = getLandingContent();

interface ChapterConfig {
  label: string;
  description: string;
  /** Manual start time in seconds. Omit to auto-divide evenly. */
  startTime?: number;
  /** Manual end time in seconds. Required when startTime is set. */
  endTime?: number;
}

const VIDEO_ID = "_8ZyLEge4pg";

/** Video timing per chapter — merged by index with labels from `tour.chapters`. */
const CHAPTER_TIMINGS: readonly { startTime: number; endTime: number }[] = [
  { startTime: 0, endTime: 50 },
  { startTime: 50, endTime: 72 },
  { startTime: 72, endTime: 162 },
  { startTime: 162, endTime: 203 },
  { startTime: 203, endTime: 232 },
  { startTime: 232, endTime: 270 },
  { startTime: 270, endTime: 327 },
  { startTime: 327, endTime: 345 },
  { startTime: 345, endTime: 360 },
  { startTime: 360, endTime: 382 },
  { startTime: 382, endTime: 409 },
  { startTime: 409, endTime: 439 },
];

const CHAPTERS_CONFIG: ChapterConfig[] = tour.chapters.map((ch, i) => ({
  label: ch.label,
  description: ch.description,
  startTime: CHAPTER_TIMINGS[i].startTime,
  endTime: CHAPTER_TIMINGS[i].endTime,
}));

/** Row layout for chapter tag buttons — stores indices into CHAPTERS_CONFIG. */
const TAG_ROWS = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [8, 9, 10, 11],
];

interface Chapter {
  label: string;
  description: string;
  startTime: number;
  endTime: number;
}

/**
 * Build resolved chapters from config + video duration.
 * Manual timestamps are used as-is; auto entries split the remaining time evenly.
 */
function buildChapters(duration: number): Chapter[] {
  const hasAnyManual = CHAPTERS_CONFIG.some((c) => c.startTime !== undefined);

  // Fast path: all auto — evenly divide.
  if (!hasAnyManual) {
    const segmentLength = duration / CHAPTERS_CONFIG.length;
    return CHAPTERS_CONFIG.map((c, i) => ({
      label: c.label,
      description: c.description,
      startTime: i * segmentLength,
      endTime: (i + 1) * segmentLength,
    }));
  }

  // Mixed: manual entries keep their times, auto entries fill the gaps evenly.
  const autoIndices: number[] = [];
  let manualTime = 0;

  for (let i = 0; i < CHAPTERS_CONFIG.length; i++) {
    const c = CHAPTERS_CONFIG[i];
    if (c.startTime === undefined) {
      autoIndices.push(i);
    } else {
      manualTime += c.endTime! - c.startTime;
    }
  }

  const autoSegment = autoIndices.length > 0 ? (duration - manualTime) / autoIndices.length : 0;
  const chapters: Chapter[] = [];
  let cursor = 0;

  for (let i = 0; i < CHAPTERS_CONFIG.length; i++) {
    const c = CHAPTERS_CONFIG[i];
    if (c.startTime !== undefined) {
      chapters.push({
        label: c.label,
        description: c.description,
        startTime: c.startTime,
        endTime: c.endTime!,
      });
      cursor = c.endTime!;
    } else {
      chapters.push({
        label: c.label,
        description: c.description,
        startTime: cursor,
        endTime: cursor + autoSegment,
      });
      cursor += autoSegment;
    }
  }

  return chapters;
}

/** Gradient used on filled / active buttons. */
const BUTTON_GRADIENT =
  "linear-gradient(273deg, #1DD7B2 -14.28%, #18BDE2 60.72%, #BF78AE 98.22%, #E67357 135.72%)";

function TourSection({ className, ref, ...props }: React.ComponentPropsWithRef<"section">) {
  const containerRef = useRef<HTMLElement>(null);
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const resolvedRef = (ref as React.RefObject<HTMLElement>) || containerRef;

  const [activeChapter, setActiveChapter] = useState<number | null>(null);
  const [confirmedChapter, setConfirmedChapter] = useState<number | null>(null);
  const [chapterProgress, setChapterProgress] = useState(0);
  const pendingChapterRef = useRef<number | null>(null);
  const seekingToRef = useRef<number | null>(null);
  const activeChapterRef = useRef<number | null>(null);
  const confirmedChapterRef = useRef<number | null>(null);
  const chapterProgressRef = useRef(0);

  const [duration, setDuration] = useState(0);
  const lenis = useLenis();

  const chapters = useMemo(() => buildChapters(duration), [duration]);

  useGSAP(
    () => {
      // Fade in header after background settles
      gsap.fromTo(
        ".tour-header",
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          ease: "power2.out",
          scrollTrigger: {
            trigger: resolvedRef.current,
            start: "top center+=10%",
            toggleActions: "play none none reverse",
          },
        }
      );

      gsap.fromTo(
        ".tour-video",
        { scale: 1.2 },
        {
          scale: 1,
          ease: "none",
          scrollTrigger: {
            trigger: ".tour-video",
            start: "top 85%",
            end: "top 30%",
            scrub: 0.5,
          },
        }
      );
    },
    { scope: resolvedRef }
  );

  // Preload the player when the video container scrolls into view
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          playerRef.current?.load();
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* ---- Time tracking from YouTube player ---- */
  const handleTimeUpdate = useCallback(
    (currentTime: number) => {
      if (duration === 0) return;

      // While seeking, ignore updates until the player reaches the target chapter
      if (seekingToRef.current !== null) {
        const target = chapters[seekingToRef.current];
        if (target && currentTime >= target.startTime && currentTime < target.endTime) {
          seekingToRef.current = null;
        } else {
          return;
        }
      }

      let chapterIndex = chapters.findIndex(
        (ch) => currentTime >= ch.startTime && currentTime < ch.endTime
      );

      // At/past the end of the last chapter — clamp to it so progress reaches 100%
      if (
        chapterIndex === -1 &&
        chapters.length > 0 &&
        currentTime >= chapters[chapters.length - 1].endTime
      ) {
        chapterIndex = chapters.length - 1;
      }

      if (chapterIndex !== -1) {
        // Only update state when values actually change to reduce re-renders
        if (activeChapterRef.current !== chapterIndex) {
          activeChapterRef.current = chapterIndex;
          setActiveChapter(chapterIndex);
        }
        if (confirmedChapterRef.current !== chapterIndex) {
          confirmedChapterRef.current = chapterIndex;
          setConfirmedChapter(chapterIndex);
        }

        const ch = chapters[chapterIndex];
        const progress = Math.min(
          Math.max((currentTime - ch.startTime) / (ch.endTime - ch.startTime), 0),
          1
        );

        // Only re-render when progress changes by >1% — CSS transition smooths the rest
        if (Math.abs(progress - chapterProgressRef.current) > 0.003) {
          chapterProgressRef.current = progress;
          setChapterProgress(progress);
        }
      }
    },
    [chapters, duration]
  );

  const handlePlayerReady = useCallback((dur: number) => {
    setDuration(dur);

    // If a chapter button was clicked before the player loaded, seek now.
    const pending = pendingChapterRef.current;
    if (pending !== null) {
      pendingChapterRef.current = null;
      seekingToRef.current = pending;
      // Build chapters from the fresh duration — can't use the memoized `chapters`
      // because setDuration hasn't triggered a re-render yet (stale closure).
      const builtChapters = buildChapters(dur);
      const player = playerRef.current;
      if (player && builtChapters[pending]) {
        player.seekTo(builtChapters[pending].startTime);
        player.playVideo();
      }
    }
  }, []);

  /* ---- Chapter seeking ---- */
  const seekToChapter = useCallback(
    (index: number) => {
      seekingToRef.current = index;
      activeChapterRef.current = index;
      confirmedChapterRef.current = null;
      setActiveChapter(index);
      setConfirmedChapter(null);
      setChapterProgress(0);
      chapterProgressRef.current = 0;

      // Scroll video into view via Lenis smooth scroll
      if (videoRef.current) {
        lenis?.scrollTo(videoRef.current, { offset: -32 });
      }

      const player = playerRef.current;
      if (!player || duration === 0) {
        // Player not loaded yet — store pending chapter and trigger load.
        pendingChapterRef.current = index;
        playerRef.current?.load();
        return;
      }

      player.seekTo(chapters[index].startTime);
      player.playVideo();
    },
    [chapters, duration, lenis]
  );

  return (
    <section
      ref={resolvedRef}
      data-section="4"
      className={cn("py-12 sm:py-24 overflow-hidden", className)}
      {...props}
    >
      <div className="container-lg mx-auto text-center">
        <div className="tour-header opacity-0">
          {/* Badge */}
          <SectionBadge className="text-cyan-300 bg-[rgba(10,81,97,0.20)]" data-content-path="tour.badge">
            {tour.badge}
          </SectionBadge>

          {/* Heading */}
          <Text as="h2" variant="heading-xlarge" className="mb-12">
            <span
              data-content-path="tour.title.highlight"
              style={{
                background:
                  "linear-gradient(90deg, #E37761 0%, #DD9E86 5.77%, #AFAD9C 13.94%, #58BAB9 25.96%, #4AB8C6 45.67%, #3ABDE0 75.96%, #57BBD0 99.04%)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {tour.title.highlight}
            </span>{" "}
            <span className="text-white" data-content-path="tour.title.suffix">{tour.title.suffix}</span>
          </Text>

          {/* Subtitle */}
          <Text as="p" variant="body-large" className="text-white max-w-[560px] mx-auto mb-18" data-content-path="tour.subtitle">
            {tour.subtitle}
          </Text>
        </div>

        {/* Video Player */}
        <div
          ref={videoRef}
          className="tour-video max-w-[900px] mx-auto rounded-2xl overflow-hidden mb-18 scroll-mt-8"
        >
          <YouTubePlayer
            ref={playerRef}
            videoId={VIDEO_ID}
            autoplay={false}
            onTimeUpdate={handleTimeUpdate}
            onPlayerReady={handlePlayerReady}
          />
        </div>

        {/* Chapter description */}
        {/* <div className="min-h-9 mb-12">
          <AnimatePresence mode="wait">
            {activeChapter !== null && (
              <motion.div
                key={activeChapter}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
              >
                <Text as="p" variant="body-large" className="text-white">
                  {chapters[activeChapter]?.description}
                </Text>
              </motion.div>
            )}
          </AnimatePresence>
        </div> */}

        {/* Chapter Tags */}
        <div className="flex flex-col items-center gap-4">
          {TAG_ROWS.map((row, rowIndex) => (
            <div key={rowIndex} className="flex flex-wrap justify-center gap-4">
              {row.map((chapterIndex) => {
                const chapter = CHAPTERS_CONFIG[chapterIndex];
                const isActive = chapterIndex === activeChapter;
                const isConfirmed = chapterIndex === confirmedChapter;

                return (
                  <div key={chapterIndex} className="relative overflow-hidden rounded-full">
                    {/* z-0: gradient — always visible */}
                    <div className="absolute inset-0 z-0" style={{ background: BUTTON_GRADIENT }} />

                    {/* z-[1]: opaque cover — fades out when active */}
                    <div
                      className="absolute inset-0 z-1"
                      style={{
                        backgroundColor: "rgb(31 41 55)",
                        opacity: isActive ? 0 : 1,
                        willChange: "opacity",
                      }}
                    />

                    {/* z-[2]: progress overlay */}
                    <div
                      className="absolute inset-0 z-2 bg-white/20 origin-left"
                      style={{
                        opacity: isConfirmed ? 1 : 0,
                        transform: `scaleX(${isConfirmed ? chapterProgress : 0})`,
                        transition:
                          isConfirmed && chapterProgress > 0
                            ? "transform 250ms linear, opacity 300ms ease"
                            : "opacity 300ms ease",
                      }}
                    />

                    {/* z-10: button — always transparent, never changes bg */}
                    <Button
                      size="large"
                      variant="primary-dark"
                      onClick={() => seekToChapter(chapterIndex)}
                      className={cn(
                        "relative z-10",
                        isActive ? "text-white border-white/40" : "hover:border-gray-400"
                      )}
                      style={{ background: "transparent", backgroundColor: "transparent" }}
                      data-content-path={`tour.chapters.${chapterIndex}.label`}
                    >
                      {chapter.label}
                    </Button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export { TourSection };
