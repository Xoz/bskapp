import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Separat byggkatalog gör lokala designprov möjliga utan att stoppa en annan dev-server.
  distDir: process.env.BSK_BUILD_DIR || ".next",
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
