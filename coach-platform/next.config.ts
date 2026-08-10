import type { NextConfig } from "next";

const basePath = process.env.NEXT_BASE_PATH;
const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: { root: process.cwd() },
  ...(basePath ? { basePath, trailingSlash: true } : {}),
};
export default nextConfig;
