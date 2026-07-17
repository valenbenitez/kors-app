import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Resolved from node_modules at runtime so the Chromium binary is traced
  // correctly on Vercel instead of being (mis)bundled into the function.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "puppeteer"],
  async redirects() {
    return [
      {
        source: "/",
        destination: "/login",
        permanent: true
      }
    ]
  },
};

export default nextConfig;
