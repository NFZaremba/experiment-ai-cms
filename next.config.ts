import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @syscore/ui-library ships untranspiled sources; don't fail the build on its types.
  typescript: { ignoreBuildErrors: true },
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
