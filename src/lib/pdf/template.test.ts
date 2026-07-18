import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { formToFormulaInput } from "@/lib/cotizador/build-input";
import { calcularCotizacion } from "@/lib/cotizador/formula";
import { clientPdfFilename, generateCotNumber } from "@/lib/pdf/cot-number";
import {
  buildCot0010Form,
  buildCot0010PdfData,
} from "@/lib/pdf/fixture-cot-0010";
import { htmlToPdf } from "@/lib/pdf/generate";
import { renderPdfHtml } from "@/lib/pdf/template";
import type { CotizacionFormInput } from "@/lib/validations/cotizacion";

const SNAPSHOT_DIR = join(process.cwd(), "src/lib/pdf/__snapshots__/cot-0010");
const UPDATE = process.env.UPDATE_PDF_SNAPSHOTS === "1";

/** Strings that belong to the Krystel / COT-0010 example case — must not leak into other quotes. */
const COT_0010_LEAKAGE = [
  "Krystel",
  "Lima ↔ Buenos Aires",
  "LATAM 2445",
  "LATAM 2464",
  "Mar 28",
  "Vie 31",
  "Yvy",
  "JetSMART 3150",
  "JetSMART 3151",
  "descuento -31%",
  "fiestas patrias Perú",
  "Tienda León",
  "USD ~730",
] as const;

function buildBarilocheLeakageForm(): CotizacionFormInput {
  return {
    clienteNombre: "Ana Pérez",
    paisOrigen: "Argentina",
    whatsapp: "+5491112345678",
    perfil: "Pareja",
    destinosSeleccionados: ["Bariloche"],
    fechaIda: "2027-03-10",
    fechaVuelta: "2027-03-15",
    paxAdultos: 2,
    paxMenores: 0,
    edadesMenores: [],
    metodoPago: "efectivo",
    equipaje: "valija 23 kg",
    aerolinea: "Aerolíneas Argentinas",
    itinerario: `Día 1 · Mié 10 Mar: Buenos Aires → Bariloche
Vuelo AR1620. Check-in Hotel Nahuel Huapi.

Día 2 · Jue 11 Mar: Circuito Chico
Mañana libre / excursión a confirmar.

Día 5 · Dom 15 Mar: Bariloche → Buenos Aires
Regreso.`,
    destinos: [
      {
        destino: "Bariloche",
        moneda: "ARS",
        vueloIdaAdultoArs: 180_000,
        vueloIdaMenorArs: 0,
        vueloVueltaAdultoArs: 180_000,
        vueloVueltaMenorArs: 0,
        hotelAdultoArs: 95_000,
        hotelMenorArs: 0,
        hotelNombre: "Hotel Nahuel Huapi",
        hotelCategoria: "4★",
        hotelRegimen: "desayuno incluido",
        hotelUbicacion: "Centro Bariloche",
        hotelHabitacion: "Doble Standard",
        hotelAjusteArs: 0,
        hotelAjusteRazon: "",
        excursionIds: [],
      },
    ],
  };
}

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

  it("experience detail uses catalog provider only (no case-specific fluff)", () => {
    expect(html).toContain("proveedor CARACOL");
    expect(html).not.toContain("día completo PN Iguazú");
    expect(html).not.toContain("lado brasileño + parque temático familiar");
  });
});

describe("renderPdfHtml — no COT-0010 leakage", () => {
  it("Bariloche form (Ana Pérez) shows form data and no Krystel/COT-0010 strings", () => {
    const form = buildBarilocheLeakageForm();
    const result = calcularCotizacion(formToFormulaInput(form));
    const html = renderPdfHtml({
      cotNumber: "COT-2099",
      form,
      result,
      generatedAt: "2027-01-15",
    });

    expect(html).toContain("Hola, Ana");
    expect(html).toContain("BARILOCHE");
    expect(html).toContain("Hotel Nahuel Huapi");
    expect(html).toContain("Aerolíneas Argentinas");
    expect(html).toMatch(/10\s*mar\.?\s*2027/i);
    expect(html).toMatch(/15\s*mar\.?\s*2027/i);
    expect(html).toContain("COT-2099");

    for (const leak of COT_0010_LEAKAGE) {
      expect(html, `must not leak: ${leak}`).not.toContain(leak);
    }

    // Must not invent Iguazú editorial copy for another destination
    expect(html).not.toContain("IGUAZÚ");
    expect(html).not.toContain("Iguazú");
    expect(html).not.toContain("Puerto Iguazú");
    expect(html).not.toContain("Garganta del Diablo");
    expect(html).not.toContain("Parque de las Aves");
    expect(html).not.toContain("La Rueda 1975");
    expect(html).not.toContain("Selva Iryapú");
  });

  it("Iguazú form without fixture overrides uses generic excludes (no case routes/dates)", () => {
    const form = buildCot0010Form();
    // Strip case-specific itinerary / hotel discount narrative from the form path
    form.itinerario = `Día 1 · Mar 15 Ago: Llegada a Iguazú
Check-in hotel.

Día 2 · Mié 16 Ago: Cataratas Argentinas
Día en el parque.

Día 3 · Jue 17 Ago: Regreso`;
    form.clienteNombre = "María Gómez";
    form.fechaIda = "2026-08-15";
    form.fechaVuelta = "2026-08-17";
    form.destinos[0].hotelNombre = "Hotel Cataratas Resort";
    form.destinos[0].hotelAjusteRazon = "";

    const result = calcularCotizacion(formToFormulaInput(form));
    const html = renderPdfHtml({
      cotNumber: "COT-0042",
      form,
      result,
      generatedAt: "2026-07-01",
    });

    expect(html).toContain("Hola, María");
    expect(html).toContain("Hotel Cataratas Resort");
    expect(html).toMatch(/15\s*ago\.?\s*2026/i);

    expect(html).not.toContain("Lima ↔ Buenos Aires");
    expect(html).not.toContain("LATAM 2445");
    expect(html).not.toContain("Mar 28");
    expect(html).not.toContain("Vie 31");
    expect(html).not.toContain("Yvy");
    expect(html).not.toContain("Krystel");
    expect(html).not.toContain("descuento aplicado sobre tarifa rack");
    expect(html).not.toContain("descuento -31%");
    expect(html).toContain("Vuelos internacionales no incluidos");
    expect(html).toContain("Ideal para familias");
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
