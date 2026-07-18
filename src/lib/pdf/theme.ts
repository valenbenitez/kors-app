import { CONTACT } from "@/lib/cotizador/format";

/** COT-0010 navy / gold / cream palette (visual snapshot baseline). */
export type PdfThemeColors = {
  navy: string;
  navyDeep: string;
  gold: string;
  goldBright: string;
  cream: string;
  creamSoft: string;
  muted: string;
  line: string;
  ok: string;
  no: string;
  orangeBar: string;
  text: string;
  background: string;
};

export type PdfThemeFonts = {
  /** Body / UI stack (CSS font-family value). */
  body: string;
  /** Display / headings stack (hero destination, prices). */
  display: string;
};

export type PdfThemeLogo = {
  /** Path relative to process.cwd(); embedded as data URL at render time. */
  path: string;
};

export type PdfThemeFooter = {
  whatsapp: string;
  email: string;
  calendly: string;
  evt: string;
  city: string;
};

export type PdfTheme = {
  brandName: string;
  colors: PdfThemeColors;
  fonts: PdfThemeFonts;
  logo: PdfThemeLogo;
  footer: PdfThemeFooter;
};

/** Partial overrides; nested objects are shallow-merged per section. */
export type PdfThemeOverride = {
  brandName?: string;
  colors?: Partial<PdfThemeColors>;
  fonts?: Partial<PdfThemeFonts>;
  logo?: Partial<PdfThemeLogo>;
  footer?: Partial<PdfThemeFooter>;
};

export const defaultPdfTheme: PdfTheme = {
  brandName: CONTACT.brand,
  colors: {
    navy: "#1a2b4c",
    navyDeep: "#122038",
    gold: "#c5a059",
    goldBright: "#d4a84b",
    cream: "#f7f3eb",
    creamSoft: "#fbf8f2",
    muted: "#5c667a",
    line: "#e4dfd4",
    ok: "#2f7a4f",
    no: "#b33a3a",
    orangeBar: "#d4883a",
    text: "#1a2438",
    background: "#ffffff",
  },
  fonts: {
    body: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
    display: 'Georgia, "Times New Roman", serif',
  },
  logo: {
    path: "public/assets/brand/logo_madero.png",
  },
  footer: {
    whatsapp: CONTACT.whatsapp,
    email: CONTACT.email,
    calendly: CONTACT.calendly,
    evt: CONTACT.evt,
    city: CONTACT.city,
  },
};

/**
 * Merge partial theme overrides onto `defaultPdfTheme`.
 * Omitted sections/keys keep defaults (COT-0010 visual baseline).
 */
export function mergePdfTheme(overrides?: PdfThemeOverride): PdfTheme {
  if (!overrides) {
    return defaultPdfTheme;
  }

  return {
    brandName: overrides.brandName ?? defaultPdfTheme.brandName,
    colors: { ...defaultPdfTheme.colors, ...overrides.colors },
    fonts: { ...defaultPdfTheme.fonts, ...overrides.fonts },
    logo: { ...defaultPdfTheme.logo, ...overrides.logo },
    footer: { ...defaultPdfTheme.footer, ...overrides.footer },
  };
}
