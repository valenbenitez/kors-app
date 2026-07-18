import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultPdfTheme } from "@/lib/pdf/theme";

/** Logo embedded as data URL (Puppeteer does not depend on HTTP). */
const logoCache = new Map<string, string>();

export function getLogoDataUrl(
  path: string = defaultPdfTheme.logo.path,
): string {
  const cached = logoCache.get(path);
  if (cached) return cached;

  const buf = readFileSync(join(process.cwd(), path));
  const dataUrl = `data:image/png;base64,${buf.toString("base64")}`;
  logoCache.set(path, dataUrl);
  return dataUrl;
}
