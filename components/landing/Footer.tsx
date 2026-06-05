"use client";

import { IWBILogo, Text, cn } from "@syscore/ui-library";
import { getLandingContent } from "@/lib/content";

const { footer } = getLandingContent();

function Footer({ className, ref, ...props }: React.ComponentPropsWithRef<"footer">) {
  return (
    <footer
      ref={ref}
      className={cn("bg-white py-12 sm:py-24 min-h-[600px] flex items-center", className)}
      {...props}
    >
      <div className="footer-content container-lg mx-auto">
        <div className="flex flex-col md:flex-row items-start gap-12  justify-center">
          {/* IWBI Logo */}
          <div className="flex items-center gap-4 shrink-0">
            <IWBILogo />
          </div>

          {/* Copyright & Trademarks */}
          <div className="max-w-[492px]">
            <Text as="p" variant="body-small" className="font-medium mb-6" data-content-path="footer.copyright">
              {footer.copyright}
            </Text>
            <Text as="p" variant="body-small" className="text-gray-600" data-content-path="footer.trademark">
              {footer.trademark}
            </Text>
          </div>
        </div>
      </div>
    </footer>
  );
}

export { Footer };
