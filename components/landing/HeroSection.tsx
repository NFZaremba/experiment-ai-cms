"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { Text, Button } from "@syscore/ui-library";
import Image from "next/image";
import { getLandingContent } from "@/lib/content";

const { hero } = getLandingContent();

function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <section
      ref={sectionRef}
      className="relative flex flex-col pt-40 sm:pt-64  items-center min-h-[720px] bg-cyan-900 overflow-hidden"
    >
      <motion.div
        className="absolute bottom-0 items-center justify-center max-w-[1595px] mx-auto flex"
        initial={{ opacity: 0, scale: 1 }}
        animate={imageLoaded ? { opacity: 1, scale: 1.1 } : undefined}
        transition={{
          opacity: { duration: 1, ease: [0.25, 0.46, 0.45, 0.94] },
          scale: {
            duration: 3.5,
            ease: [0.45, 0.05, 0.55, 0.95],
            repeat: Infinity,
            repeatType: "mirror",
          },
        }}
        style={{ willChange: "transform, opacity", transformOrigin: "center bottom" }}
      >
        <Image
          src="/img/half-sphere.webp"
          alt="WELL Standard Sphere"
          width={1595}
          height={830}
          sizes="(max-width: 768px) 100vw, 1595px"
          priority
          onLoad={() => setImageLoaded(true)}
          className="w-[1595px] max-w-none md:max-w-full object-bottom object-contain select-none pointer-events-none"
        />
      </motion.div>

      {/* Hero Content */}
      <header className="relative z-10 flex flex-col items-center text-center overflow-visible px-8">
        <div className="mb-6">
          <Text as="p" variant="heading-large">
            <span
              data-content-path="hero.eyebrow"
              style={{
                background:
                  "linear-gradient(90deg, #084654 0.08%, #2D718A 50.08%, #084654 100.08%)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {hero.eyebrow}
            </span>
          </Text>
        </div>
        <div className="text-white mb-12">
          <Text
            as="h1"
            variant="heading-xlarge"
            className="text-white"
            data-content-path="hero.title"
          >
            {hero.title}
          </Text>
        </div>
        <div className="text-white mb-18">
          <Text
            as="p"
            variant="body-large"
            className="text-white max-w-[600px]"
            data-content-path="hero.body"
            data-field-type="richtext"
            dangerouslySetInnerHTML={{ __html: hero.body }}
          />
        </div>

        <motion.div
          className="hero-button flex flex-col justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{ willChange: "transform, opacity" }}
        >
          <Button
            variant="secondary-light"
            size="xlarge"
            className="shadow-2xl border-none min-w-80"
            data-content-path="hero.cta"
            data-field-type="link"
            data-href={hero.cta.href}
            data-newtab={String(hero.cta.newTab)}
            onClick={() =>
              window.open(hero.cta.href, hero.cta.newTab ? "_blank" : "_self", "noopener")
            }
          >
            {hero.cta.label}
          </Button>
          {hero.commentPeriod.date && (
            <Text as="p" variant="body-small" className="text-gray-300 italic">
              {hero.commentPeriod.label}{" "}
              <span className="text-white font-semibold">{hero.commentPeriod.date}</span>
            </Text>
          )}
        </motion.div>
      </header>
    </section>
  );
}

export { HeroSection };
