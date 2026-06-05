"use client";

import { useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { ReactLenis, useLenis } from "lenis/react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { IntroSection, HeroSection, Footer } from "@/components/landing";
import { Text, Button } from "@syscore/ui-library";
import { getLandingContent } from "@/lib/content";

// Below-fold sections — split into separate chunks so they don't block
// initial hydration. ssr: true keeps the HTML in the server response so
// ScrollTrigger finds the elements at setup time.
const FeaturesSection = dynamic(() =>
  import("@/components/landing/FeaturesSection").then((m) => m.FeaturesSection)
);
const TourSection = dynamic(() =>
  import("@/components/landing/TourSection").then((m) => m.TourSection)
);
const VisionSection = dynamic(() =>
  import("@/components/landing/VisionSection").then((m) => m.VisionSection)
);
const RoadmapSection = dynamic(() =>
  import("@/components/landing/RoadmapSection").then((m) => m.RoadmapSection)
);
const FeedbackSection = dynamic(() =>
  import("@/components/landing/FeedbackSection").then((m) => m.FeedbackSection)
);

const { hero } = getLandingContent();

// Standalone marketing build: no auth. The fixed CTA links out to the public site.
const EXPLORE_URL = "https://www.wellcertified.com";

/** Syncs Lenis scroll events with GSAP ScrollTrigger. */
function ScrollSync() {
  useLenis(() => ScrollTrigger.update());
  return null;
}

export default function Home() {
  const footerRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fixedCtaRef = useRef<HTMLDivElement>(null);

  // Prevent browser scroll restoration so ScrollTrigger pins calculate correctly
  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);
  }, []);

  // GSAP setup is deferred to idle so it doesn't block first paint. None of the
  // ScrollTriggers fire before user scroll, so registering them late is safe.
  // gsap.context() handles cleanup of all animations created within it.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let ctx: gsap.Context | undefined;
    const refreshListeners: Array<() => void> = [];

    const setup = () => {
      ctx = gsap.context(() => {
        ScrollTrigger.config({ ignoreMobileResize: true });

        const fixedCta = fixedCtaRef.current;
        const footer = footerRef.current;

        if (fixedCta) {
          gsap.set(fixedCta, { yPercent: 100, opacity: 0 });
        }

        const mm = gsap.matchMedia();
        mm.add("(min-width: 768px)", () => {
          // Fixed CTA — show after hero button, hide at feedback CTA
          if (fixedCta) {
            const showCta = gsap.to(fixedCta, {
              yPercent: 0,
              opacity: 1,
              duration: 0.4,
              ease: "back(1)",
              paused: true,
            });

            ScrollTrigger.create({
              trigger: ".hero-button",
              start: "bottom top",
              onEnter: () => showCta.play(),
              onLeaveBack: () => showCta.reverse(),
            });

            ScrollTrigger.create({
              trigger: ".feedback-cta",
              start: "top bottom",
              onEnter: () => showCta.reverse(),
              onLeaveBack: () => showCta.play(),
            });
          }

          // Footer reveal
          if (footer) {
            // Cache overlap to avoid reading offsetHeight on every ScrollTrigger callback
            let overlap = Math.min(window.innerHeight, footer.offsetHeight);
            const updateOverlap = () => {
              overlap = Math.min(window.innerHeight, footer.offsetHeight);
            };
            ScrollTrigger.addEventListener("refreshInit", updateOverlap);
            refreshListeners.push(() =>
              ScrollTrigger.removeEventListener("refreshInit", updateOverlap)
            );

            const adjustFooterOverlap = () => {
              footer.style.marginTop = -overlap + "px";
            };

            // Apply the offset synchronously so ScrollTrigger.create below
            // measures the footer in its final position. Deferring this write
            // to RAF made ScrollTrigger cache positions ~one viewport off and
            // the footer reveal/pin never fired.
            adjustFooterOverlap();
            ScrollTrigger.addEventListener("revert", adjustFooterOverlap);
            refreshListeners.push(() => {
              ScrollTrigger.removeEventListener("revert", adjustFooterOverlap);
              footer.style.marginTop = "";
            });

            ScrollTrigger.create({
              trigger: footer,
              start: () => "top " + (window.innerHeight - overlap),
              end: () => "+=" + overlap,
              pin: true,
            });

            gsap.fromTo(
              footer.querySelector(".footer-content"),
              { scale: 0.65, opacity: 0 },
              {
                scale: 1,
                opacity: 1,
                ease: "power2.out",
                scrollTrigger: {
                  trigger: footer,
                  start: () => "top " + (window.innerHeight - overlap),
                  end: () => "+=" + overlap,
                  scrub: 2,
                },
              }
            );
          }
        });

        /* ---- Light → Dark background transition (toggle-based) ---- */
        const darkTl = gsap
          .timeline({ paused: true, defaults: { duration: 0.8, ease: "power2.inOut" } })
          .to(".main-panel", { backgroundColor: "#171820" }, 0)
          .to(".intro-paragraph", { color: "#cbcdd2" }, 0)
          .to(".intro-paragraph span", { color: "#ffffff" }, 0);

        ScrollTrigger.create({
          trigger: '[data-section="4"]',
          start: "top+=10% 80%",
          end: "+=100%",
          onToggle: (self) => {
            if (self.isActive) {
              darkTl.play();
            } else if (self.direction < 0) {
              darkTl.reverse();
            }
          },
        });
      }, container);
    };

    const supportsIdle = typeof window.requestIdleCallback === "function";
    const handle: number = supportsIdle
      ? window.requestIdleCallback(setup)
      : window.setTimeout(setup, 0);

    return () => {
      if (supportsIdle) window.cancelIdleCallback(handle);
      else clearTimeout(handle);
      refreshListeners.forEach((fn) => fn());
      ctx?.revert();
    };
  }, []);

  return (
    <ReactLenis root options={{ autoRaf: true }}>
      <main ref={containerRef} className="relative">
        <ScrollSync />
        {/* Main content panel — sits on top, scrolls naturally */}
        <section className="main-panel relative z-10 bg-gray-50">
          <HeroSection />
          <IntroSection />
          <FeaturesSection />
          <TourSection />
          <VisionSection />
          <RoadmapSection />
          <FeedbackSection />
        </section>

        {/* Footer — revealed underneath as main panel scrolls away */}
        <Footer ref={footerRef} />

        {/* Fixed CTA — controlled by ScrollTrigger */}
        <div ref={fixedCtaRef} className="fixed  bottom-6 right-6  opacity-0  z-10">
          <div className="border-12 border-[#0000000A] rounded-full hover:scale-[1.02] active:scale-95 transition-transform duration-200 will-change-transform ">
            <div className="flex flex-col items-center justify-center gap-4 ">
              <Button
                variant="clear"
                size="xlarge"
                className="text-white min-w-80"
                style={{ background: "var(--gradient-cta)" }}
                onClick={() => window.open(EXPLORE_URL, "_blank", "noopener")}
              >
                {hero.ctaAuthed}
              </Button>
              {hero.commentPeriod.date && (
                <Text as="p" variant="body-small" className="text-gray-600 italic">
                  {hero.commentPeriod.label}{" "}
                  <span className="font-semibold">{hero.commentPeriod.date}</span>
                </Text>
              )}
            </div>
          </div>
        </div>
      </main>
    </ReactLenis>
  );
}
