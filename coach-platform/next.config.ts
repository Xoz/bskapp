import type { NextConfig } from "next";

const basePath = process.env.NEXT_BASE_PATH;
const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: { root: process.cwd() },
  ...(basePath ? { basePath } : {}),
};
export default nextConfig;
