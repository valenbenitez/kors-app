import { describe, expect, it } from "vitest";
import { buildCot0010PdfData } from "@/lib/pdf/fixture-cot-0010";
import { renderPdfHtml } from "@/lib/pdf/template";
import {
  defaultPdfTheme,
  mergePdfTheme,
  type PdfThemeOverride,
} from "@/lib/pdf/theme";

describe("mergePdfTheme", () => {
  it("returns default theme when called without overrides", () => {
    expect(mergePdfTheme()).toEqual(defaultPdfTheme);
    expect(mergePdfTheme(undefined)).toEqual(defaultPdfTheme);
  });

  it("preserves defaults for omitted keys when merging partial overrides", () => {
    const merged = mergePdfTheme({
      brandName: "Acme Travel",
      colors: { gold: "#ff00aa" },
      footer: { email: "hello@acme.test" },
    });

    expect(merged.brandName).toBe("Acme Travel");
    expect(merged.colors.gold).toBe("#ff00aa");
    expect(merged.colors.navy).toBe(defaultPdfTheme.colors.navy);
    expect(merged.colors.cream).toBe(defaultPdfTheme.colors.cream);
    expect(merged.fonts).toEqual(defaultPdfTheme.fonts);
    expect(merged.logo).toEqual(defaultPdfTheme.logo);
    expect(merged.footer.email).toBe("hello@acme.test");
    expect(merged.footer.whatsapp).toBe(defaultPdfTheme.footer.whatsapp);
    expect(merged.footer.calendly).toBe(defaultPdfTheme.footer.calendly);
  });

  it("merges fonts and logo independently", () => {
    const override: PdfThemeOverride = {
      fonts: { display: "Palatino, serif" },
      logo: { path: "public/assets/brand/custom.png" },
    };
    const merged = mergePdfTheme(override);

    expect(merged.fonts.body).toBe(defaultPdfTheme.fonts.body);
    expect(merged.fonts.display).toBe("Palatino, serif");
    expect(merged.logo.path).toBe("public/assets/brand/custom.png");
    expect(merged.brandName).toBe(defaultPdfTheme.brandName);
  });
});

describe("renderPdfHtml — theme CSS tokens", () => {
  it("emits default theme color CSS vars and font stacks", () => {
    const html = renderPdfHtml(buildCot0010PdfData());
    const { colors, fonts, brandName, footer } = defaultPdfTheme;

    expect(html).toContain(`--navy: ${colors.navy}`);
    expect(html).toContain(`--navy-deep: ${colors.navyDeep}`);
    expect(html).toContain(`--gold: ${colors.gold}`);
    expect(html).toContain(`--gold-bright: ${colors.goldBright}`);
    expect(html).toContain(`--cream: ${colors.cream}`);
    expect(html).toContain(`--cream-soft: ${colors.creamSoft}`);
    expect(html).toContain(`--font-body: ${fonts.body}`);
    expect(html).toContain(`--font-display: ${fonts.display}`);
    expect(html).toContain(brandName);
    expect(html).toContain(footer.whatsapp);
    expect(html).toContain(footer.email);
  });

  it("applies theme overrides to CSS vars and footer contact text", () => {
    const html = renderPdfHtml({
      ...buildCot0010PdfData(),
      theme: {
        brandName: "Override Brand",
        colors: { navy: "#001122", gold: "#abcdef" },
        fonts: { body: "Verdana, sans-serif" },
        footer: { whatsapp: "+54 9 11 9999-0000", email: "x@override.test" },
      },
    });

    expect(html).toContain("--navy: #001122");
    expect(html).toContain("--gold: #abcdef");
    expect(html).toContain("--navy-deep: #122038");
    expect(html).toContain("--font-body: Verdana, sans-serif");
    expect(html).toContain('--font-display: Georgia, "Times New Roman", serif');
    expect(html).toContain("Override Brand");
    expect(html).toContain("+54 9 11 9999-0000");
    expect(html).toContain("x@override.test");
    expect(html).toContain("<title>");
    expect(html).toMatch(/<title>[^<]*Override Brand<\/title>/);
    expect(html).toContain(
      `Override Brand · EVT ${defaultPdfTheme.footer.evt}`,
    );
    expect(html).not.toContain(
      `Madero Viagens · EVT ${defaultPdfTheme.footer.evt}`,
    );
  });
});
