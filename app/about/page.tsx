"use client";

import { Text } from "@syscore/ui-library";
import { EditModeBridge } from "@/components/studio/EditModeBridge";
import { useIsEditMode } from "@/lib/studio/use-edit-mode";
import { AboutHero } from "@/components/about/AboutHero";
import { AboutIntro } from "@/components/about/AboutIntro";
import { SolutionsGrid } from "@/components/about/SolutionsGrid";
import { AnnualReport } from "@/components/about/AnnualReport";
import { SumBanner } from "@/components/about/SumBanner";
import { LeadershipTeam } from "@/components/about/LeadershipTeam";
import { StatsBand } from "@/components/about/StatsBand";

/**
 * The "About Us / People-First Places" page — a clean, animation-free copy of a
 * real marketing page that serves as the rich playground for constrained AI
 * layout editing. Each section reads its layout from the vocabulary in
 * lib/content/layout-vocab.ts and re-renders live via the draft store; in edit
 * mode a "✦" chip opens the panel's option buttons + AI box. See
 * docs/handoff-2026-06-07.md and the page-2 fixture for the pattern.
 */
export default function AboutPage() {
  const isEdit = useIsEditMode();

  return (
    <main className="bg-gray-50">
      <EditModeBridge active={isEdit} />
      <AboutHero />
      <AboutIntro />
      <SolutionsGrid />
      <AnnualReport />
      <SumBanner />
      <LeadershipTeam />
      <StatsBand />

      {/* Minimal static footer — intentionally NOT the landing Footer, which is
          bound to home content (its edits would mis-target the home document). */}
      <footer className="bg-gray-900 py-12">
        <div className="container-sm mx-auto flex flex-col gap-2">
          <Text as="p" variant="body-base" className="text-white/80">
            We are transforming health and well-being with our people-first approach to
            buildings, organizations and communities.
          </Text>
          <Text as="p" variant="body-small" className="text-white/40">
            © International WELL Building Institute
          </Text>
        </div>
      </footer>
    </main>
  );
}
