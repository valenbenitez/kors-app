import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  serverExternalPackages: [
    "@sparticuz/chromium",
    "puppeteer-core",
    "puppeteer",
    "firebase-admin",
  ],
  outputFileTracingIncludes: {
    "/api/generate-pdf": [
      "./node_modules/@sparticuz/chromium/bin/**",
      "./node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/bin/**",
    ],
    "/api/generate-pdf/route": [
      "./node_modules/@sparticuz/chromium/bin/**",
      "./node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/bin/**",
    ],
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/login",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
