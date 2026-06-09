"use client";

import Image from "next/image";
import { Button, SectionBadge, cn } from "@syscore/ui-library";
import { EditableText } from "@/components/studio/EditableText";
import { getAboutContent } from "@/lib/content";
import { LayoutChip } from "@/components/studio/LayoutChip";
import { useLayoutValue } from "@/lib/studio/use-edit-mode";

const { report } = getAboutContent();
const PAGE = "about";

/** Annual-report callout — an image + text block. Image position is the
 *  AI-editable layout variant (left | right | stacked); same mechanic as the
 *  page-2 `feature` block. The image itself is an editable image field. */
export function AnnualReport() {
  const imagePosition = useLayoutValue(PAGE, "report.imagePosition", report.imagePosition);

  return (
    <section className="relative bg-white py-20">
      <LayoutChip path="report.imagePosition" value={imagePosition} label="Image position" />
      <div className="container-sm mx-auto">
        <div
          className={cn(
            "flex items-center gap-10 rounded-lg border border-gray-200 bg-gray-50 p-8",
            imagePosition === "stacked" ? "flex-col" : "flex-col md:flex-row",
            imagePosition === "left" && "md:flex-row-reverse"
          )}
        >
          <div className="flex-1">
            <SectionBadge className="mb-4 bg-bronze-50 text-bronze-600" data-content-path="report.tag">
              {report.tag}
            </SectionBadge>
            <EditableText as="h2" variant="heading-small" className="text-gray-800" path="report.heading">
              {report.heading}
            </EditableText>
            <EditableText as="p" variant="body-large" className="mt-4 text-gray-600" path="report.body">
              {report.body}
            </EditableText>
            <Button
              variant="primary-dark"
              size="large"
              className="mt-6"
              onClick={() => window.open("https://www.wellcertified.com", "_blank", "noopener")}
              data-content-path="report.cta"
            >
              {report.cta}
            </Button>
          </div>
          <div className="relative aspect-[4/3] w-full flex-1 overflow-hidden rounded-md bg-gray-100">
            <Image
              src={report.image.src}
              alt={report.image.alt}
              data-content-path="report.image"
              data-field-type="image"
              data-src={report.image.src}
              fill
              sizes="(max-width: 768px) 100vw, 480px"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
