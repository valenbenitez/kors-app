import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Logo Madero embebido como data URL (Puppeteer no depende de HTTP). */
let cachedLogoDataUrl: string | null = null;

export function getLogoDataUrl(): string {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  const buf = readFileSync(
    join(process.cwd(), "public/assets/brand/logo_madero.png"),
  );
  cachedLogoDataUrl = `data:image/png;base64,${buf.toString("base64")}`;
  return cachedLogoDataUrl;
}
