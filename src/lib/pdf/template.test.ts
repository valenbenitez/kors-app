import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { clientPdfFilename, generateCotNumber } from "@/lib/pdf/cot-number";
import { buildCot0010PdfData } from "@/lib/pdf/fixture-cot-0010";
import { htmlToPdf } from "@/lib/pdf/generate";
import { renderPdfHtml } from "@/lib/pdf/template";

const SNAPSHOT_DIR = join(process.cwd(), "src/lib/pdf/__snapshots__/cot-0010");
const UPDATE = process.env.UPDATE_PDF_SNAPSHOTS === "1";

describe("cot-number", () => {
  it("genera COT-XXXX de 4 dígitos", () => {
    expect(generateCotNumber(10)).toBe("COT-0010");
    expect(generateCotNumber(123456)).toBe("COT-3456");
  });

  it("filename cliente sin nombre del lead", () => {
    expect(clientPdfFilename("COT-0010")).toBe("COT-0010_cliente.pdf");
  });
});

describe("renderPdfHtml — fixture COT-0010", () => {
  const data = buildCot0010PdfData();
  const html = renderPdfHtml(data);

  it("calcula precio final CEILING 5314 / 760 pp", () => {
    expect(data.result.precioFinalCliente).toBe(5314);
    expect(data.result.precioAdultoCliente).toBe(760);
  });

  it("tiene 3 páginas A4 y orden de secciones de la ref", () => {
    expect(html.match(/class="page[\s"]/g)?.length).toBe(3);

    // Página 1
    expect(html).toContain("Hola, Krystel");
    expect(html).toContain("IGUAZÚ");
    expect(html).toMatch(/Total por persona/i);
    expect(html).toContain("Salida");
    expect(html).toContain("Regreso");
    expect(html).toContain("Pasajeros");
    expect(html).toContain("Alojamiento");
    expect(html).toContain("Total general");
    expect(html).toContain("¿Qué incluye?");
    expect(html).toContain("¿Qué no incluye?");
    expect(html).toContain("Itinerario día a día");
    expect(html).toContain("Forma de pago");
    expect(html).toContain("Documento confidencial");

    // Página 2
    expect(html).toContain("Guía del Destino");
    expect(html).toContain("Experiencias incluidas");
    expect(html).toContain("Excursiones disponibles");
    expect(html).toContain("Gran Aventura");
    expect(html).toContain("Helicóptero");
    expect(html).toContain("Selva Iryapú");
    expect(html).toContain("Tips familia");
    expect(html).toContain("Gastronomía recomendada");
    expect(html).toContain("Clima en tu viaje");
    expect(html).toContain("Qué llevar");

    // Página 3
    expect(html).toContain("Dónde queda");
    expect(html).toContain("asesoría personalizada");
    expect(html).toContain("calendly.com/madero-viagens");
    expect(html).toContain("Contacto directo");
    expect(html).toContain("EVT 14971");
  });

  it("no muestra desglose interno / auditoría", () => {
    expect(html).not.toContain("Desglose interno");
    expect(html).not.toContain("auditoría");
    expect(html).not.toContain("Margen agencia");
    expect(html).not.toContain("CEILING");
  });

  it("no tiene placeholders editoriales", () => {
    expect(html).not.toContain("pendiente de");
    expect(html).not.toContain("Placeholder");
    expect(html).not.toContain("placeholder");
  });

  it("usa logo embebido data URL y paleta navy", () => {
    expect(html).toContain("data:image/png;base64,");
    expect(html).toContain("--navy: #1a2b4c");
    expect(html).toContain("--gold: #c5a059");
  });

  it("incluye exclusiones reales y nombres de excursión", () => {
    expect(html).toContain("Lima ↔ Buenos Aires");
    expect(html).toContain("PQT 01A");
    expect(html).toContain("Cataratas Brasileras");
    expect(html).toContain("USD 34 / pax");
    expect(html).toContain("USD 47 / pax");
  });

  it("maneja acentos y textos largos sin romper escape", () => {
    expect(html).toContain("Iguazú");
    expect(html).toContain("Brasileras");
    expect(html).toContain("Garganta del Diablo");
  });
});

describe("snapshots visuales COT-0010", () => {
  it(
    "genera PDF de 3 páginas y compara PNG por página",
    { timeout: 120_000 },
    async () => {
      const data = buildCot0010PdfData();
      const html = renderPdfHtml(data);
      const pdf = await htmlToPdf(html);
      expect(pdf.byteLength).toBeGreaterThan(10_000);

      if (process.env.GENERATE_SAMPLE_PDF === "1") {
        writeFileSync(
          join(process.cwd(), "docs/mvp/generated-COT-0010_cliente.pdf"),
          pdf,
        );
      }

      mkdirSync(SNAPSHOT_DIR, { recursive: true });

      // Screenshot por página vía Puppeteer (misma stack que generate.ts)
      const puppeteer = await import("puppeteer");
      const browser = await puppeteer.default.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      try {
        const page = await browser.newPage();
        // A4 @ 96dpi ≈ 794×1123
        await page.setViewport({
          width: 794,
          height: 1123,
          deviceScaleFactor: 1,
        });
        await page.setContent(html, { waitUntil: "load" });

        const pages = await page.$$(".page");
        expect(pages.length).toBe(3);

        for (let i = 0; i < pages.length; i++) {
          const shot = (await pages[i].screenshot({
            type: "png",
          })) as Buffer;
          const name = `page-${i + 1}.png`;
          const baselinePath = join(SNAPSHOT_DIR, name);
          const actualPath = join(SNAPSHOT_DIR, `actual-${name}`);
          const diffPath = join(SNAPSHOT_DIR, `diff-${name}`);

          writeFileSync(actualPath, shot);

          if (UPDATE) {
            writeFileSync(baselinePath, shot);
            continue;
          }

          let baseline: Buffer;
          try {
            baseline = readFileSync(baselinePath);
          } catch {
            writeFileSync(baselinePath, shot);
            continue;
          }

          const img1 = PNG.sync.read(baseline);
          const img2 = PNG.sync.read(shot);
          expect(img1.width).toBe(img2.width);
          expect(img1.height).toBe(img2.height);

          const diff = new PNG({ width: img1.width, height: img1.height });
          const mismatched = pixelmatch(
            img1.data,
            img2.data,
            diff.data,
            img1.width,
            img1.height,
            { threshold: 0.12 },
          );
          writeFileSync(diffPath, PNG.sync.write(diff));

          const total = img1.width * img1.height;
          const ratio = mismatched / total;
          // Tolerancia: tipografía/AA; falla si > 2.5% de píxeles difieren
          expect(ratio).toBeLessThan(0.025);
        }
      } finally {
        await browser.close();
      }
    },
  );
});
