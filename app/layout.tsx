import type { Metadata } from "next";
import "./globals.css";
import { StudioMount } from "@/components/studio/StudioMount";

export const metadata: Metadata = {
  title: "OneWELL — A first look at the next version of WELL",
  description:
    "Revolutionizing how organizations invest in health—with a unified experience that is simpler to understand, easier to implement and built for scale.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href="/fonts/FT-Made/FTMade-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Mazzard-M/mazzardsoftm-regular.otf"
          as="font"
          type="font/otf"
          crossOrigin="anonymous"
        />
      </head>
      <body className="bg-gray-50">
        {children}
        <StudioMount />
      </body>
    </html>
  );
}
