"use client";

import { useMemo } from "react";
import { Text } from "@syscore/ui-library";
import { getPage2Content } from "@/lib/content";
import { EditModeBridge } from "@/components/studio/EditModeBridge";

const page = getPage2Content();

/**
 * Minimal second page — the multi-page test fixture.
 *
 * Content-driven (own JSON + schema) and edit-mode-ready: under `?edit=1` it
 * mounts the same EditModeBridge as the landing page, with plain-text
 * `data-content-path` leaves scoped WITHIN this page's file (e.g. `title`,
 * `sections.0.heading`). The Studio shell doesn't iframe this route yet —
 * wiring the page switcher + per-page publish is the next phase
 * (docs/multi-page-publish_checkpoint.md). No GSAP/Lenis here; it's plain copy.
 */
export default function Page2() {
  const isEdit = useMemo(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("edit") === "1",
    []
  );

  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <EditModeBridge active={isEdit} />

      <Text as="h1" variant="heading-xlarge" data-content-path="title">
        {page.title}
      </Text>
      <Text
        as="p"
        variant="body-large"
        className="mt-4 text-gray-600"
        data-content-path="intro"
      >
        {page.intro}
      </Text>

      <div className="mt-14 flex flex-col gap-10">
        {page.sections.map((s, i) => (
          <section key={i}>
            <Text as="h2" variant="heading-large" data-content-path={`sections.${i}.heading`}>
              {s.heading}
            </Text>
            <Text
              as="p"
              variant="body-large"
              className="mt-2 text-gray-600"
              data-content-path={`sections.${i}.body`}
            >
              {s.body}
            </Text>
          </section>
        ))}
      </div>
    </main>
  );
}
