import { describe, expect, it } from "vitest";
import {
  KELLY_IGUAZU_V28_INPUT,
  KELLY_IGUAZU_V28_PRECIO_FINAL_CLIENTE,
} from "@/lib/cotizador/fixtures/kelly-iguazu-v28";
import {
  calcularCotizacion,
  type ExcursionInput,
  FormulaError,
} from "@/lib/cotizador/formula";
import { FORMULA_PARAMS } from "@/lib/cotizador/params";

/**
 * Golden suite notes (PRD P0 / spec §5):
 * - Notion task names COT-0001..0006 refer to historical **v2.7** rows (wrong goldens).
 * - Spec bit-exact starts at COT-0007+ (v2.8). We ship Kelly (spec COT-0007) + COT-0010
 *   + minors policy A–D — not invented fake 0001–0006 fixtures.
 */

const baseExc = (
  overrides: Partial<ExcursionInput> & Pick<ExcursionInput, "neto">,
): ExcursionInput => ({
  id: "e1",
  nombre: "Excursión test",
  moneda: "USD",
  precioMenor: null,
  politicaMenores: "Mismo adulto",
  ...overrides,
});

describe("calcularCotizacion — políticas de menores (excursiones)", () => {
  it("Test A — Mismo adulto: 2 ad + 1 menor → 150 USD en exp", () => {
    const result = calcularCotizacion({
      paxAdultos: 2,
      paxMenores: 1,
      metodoPago: "efectivo",
      destinos: [
        {
          destino: "Bariloche",
          vueloIdaAdultoArs: 0,
          vueloIdaMenorArs: 0,
          vueloVueltaAdultoArs: 0,
          vueloVueltaMenorArs: 0,
          hotelNoches: 0,
          hotelAdultoNocheArs: 0,
          hotelMenorNocheArs: 0,
          excursiones: [baseExc({ neto: 50, politicaMenores: "Mismo adulto" })],
        },
      ],
    });

    expect(result.subtotalUsd).toBe(150);
  });

  it("Test B — Precio especial: 2 ad + 2 menores → 280 USD", () => {
    const result = calcularCotizacion({
      paxAdultos: 2,
      paxMenores: 2,
      metodoPago: "efectivo",
      destinos: [
        {
          destino: "Bariloche",
          vueloIdaAdultoArs: 0,
          vueloIdaMenorArs: 0,
          vueloVueltaAdultoArs: 0,
          vueloVueltaMenorArs: 0,
          hotelNoches: 0,
          hotelAdultoNocheArs: 0,
          hotelMenorNocheArs: 0,
          excursiones: [
            baseExc({
              neto: 100,
              precioMenor: 40,
              politicaMenores: "Precio especial",
            }),
          ],
        },
      ],
    });

    expect(result.subtotalUsd).toBe(280);
  });

  it("Test C — No aplica: 1 ad + 2 menores → 80 USD", () => {
    const result = calcularCotizacion({
      paxAdultos: 1,
      paxMenores: 2,
      metodoPago: "efectivo",
      destinos: [
        {
          destino: "Bariloche",
          vueloIdaAdultoArs: 0,
          vueloIdaMenorArs: 0,
          vueloVueltaAdultoArs: 0,
          vueloVueltaMenorArs: 0,
          hotelNoches: 0,
          hotelAdultoNocheArs: 0,
          hotelMenorNocheArs: 0,
          excursiones: [baseExc({ neto: 80, politicaMenores: "No aplica" })],
        },
      ],
    });

    expect(result.subtotalUsd).toBe(80);
  });

  it("Test D — Consultar + menores → STOP", () => {
    expect(() =>
      calcularCotizacion({
        paxAdultos: 1,
        paxMenores: 1,
        metodoPago: "efectivo",
        destinos: [
          {
            destino: "Bariloche",
            vueloIdaAdultoArs: 0,
            vueloIdaMenorArs: 0,
            vueloVueltaAdultoArs: 0,
            vueloVueltaMenorArs: 0,
            hotelNoches: 0,
            hotelAdultoNocheArs: 0,
            hotelMenorNocheArs: 0,
            excursiones: [baseExc({ neto: 50, politicaMenores: "Consultar" })],
          },
        ],
      }),
    ).toThrow(FormulaError);
  });

  it("Precio especial + precioMenor null + no minors → succeeds (adults only)", () => {
    const result = calcularCotizacion({
      paxAdultos: 2,
      paxMenores: 0,
      metodoPago: "efectivo",
      destinos: [
        {
          destino: "Bariloche",
          vueloIdaAdultoArs: 0,
          vueloIdaMenorArs: 0,
          vueloVueltaAdultoArs: 0,
          vueloVueltaMenorArs: 0,
          hotelNoches: 0,
          hotelAdultoNocheArs: 0,
          hotelMenorNocheArs: 0,
          excursiones: [
            baseExc({
              neto: 100,
              precioMenor: null,
              politicaMenores: "Precio especial",
            }),
          ],
        },
      ],
    });

    expect(result.subtotalUsd).toBe(200);
    expect(result.subtotalMenoresUsd).toBe(0);
  });

  it("Precio especial + precioMenor null + minors → throws FormulaError", () => {
    expect(() =>
      calcularCotizacion({
        paxAdultos: 1,
        paxMenores: 1,
        metodoPago: "efectivo",
        destinos: [
          {
            destino: "Bariloche",
            vueloIdaAdultoArs: 0,
            vueloIdaMenorArs: 0,
            vueloVueltaAdultoArs: 0,
            vueloVueltaMenorArs: 0,
            hotelNoches: 0,
            hotelAdultoNocheArs: 0,
            hotelMenorNocheArs: 0,
            excursiones: [
              baseExc({
                neto: 100,
                precioMenor: null,
                politicaMenores: "Precio especial",
              }),
            ],
          },
        ],
      }),
    ).toThrow(FormulaError);
  });
});

describe("calcularCotizacion — Kelly / Iguazú v2.8 golden (spec COT-0007)", () => {
  it("kelly-iguazu-v28 → precioFinalCliente USD 1289", () => {
    const result = calcularCotizacion(KELLY_IGUAZU_V28_INPUT);

    expect(result.subtotalUsd).toBe(779.01);
    expect(result.precioPaquete).toBe(1112.87);
    expect(result.margenAgenciaUsd).toBe(333.86);
    // Spec table shows 1224.15 / 1288.58; HALF_UP path is 1224.16 / 1288.59.
    expect(result.precioPostFee).toBe(1224.16);
    expect(result.precioFinal).toBe(1288.59);
    expect(result.precioFinalCliente).toBe(
      KELLY_IGUAZU_V28_PRECIO_FINAL_CLIENTE,
    );
    expect(result.precioAdultoCliente).toBe(1289);
  });

  it("exposes paso 1–2 intermediates matching spec table (HALF_UP 2dp)", () => {
    const result = calcularCotizacion(KELLY_IGUAZU_V28_INPUT);
    const d = result.destinos[0];
    expect(d).toBeDefined();
    expect(result.tcArsUsd).toBe(1420);
    // Spec §5: vuelo ida 103.87, vuelta 104.14, hotel 247.40, exc 305.00
    expect(d?.vueloIdaAdultoUsd).toBe(103.87);
    expect(d?.vueloVueltaAdultoUsd).toBe(104.14);
    expect(d?.hotelAdultoUsd).toBe(247.4);
    expect(d?.experienciasAdultoUsd).toBe(305);
    // Spec §5: adj 109.34, 109.62, 255.05, exc 305
    expect(d?.vueloIdaAdultoAdj).toBe(109.34);
    expect(d?.vueloVueltaAdultoAdj).toBe(109.62);
    expect(d?.hotelAdultoAdj).toBe(255.05);
    expect(result.precioAdultoBase).toBe(1224.16);
    expect(result.precioAdultoFinal).toBe(1288.59);
  });

  it("accepts params override (agency margin) without mutating defaults", () => {
    const withCash = calcularCotizacion(
      { ...KELLY_IGUAZU_V28_INPUT, metodoPago: "efectivo" },
      { ...FORMULA_PARAMS, agencyMarginPct: 0.35 },
    );
    // Higher agency margin → higher final than default v2.8 path for efectivo.
    const baseline = calcularCotizacion({
      ...KELLY_IGUAZU_V28_INPUT,
      metodoPago: "efectivo",
    });
    expect(withCash.precioFinalCliente).toBeGreaterThan(
      baseline.precioFinalCliente,
    );
  });
});

describe("calcularCotizacion — pasos 4→9 desde costo neto (COT-0010)", () => {
  it("margen + tarjeta + vendedor + CEILING → USD 5314", () => {
    // Replica los pasos post-subtotal con el costo neto documentado.
    // subtotal 3212.17 → paquete 4588.81 → post_fee 5047.69 → final 5313.36 → CEIL 5314
    // Usamos un destino sintético cuyo subtotal sea exactamente 3212.17:
    // 3212.17 USD en ARS @ TC 1420 = 4,561,281.4 → usamos excursión USD directa.
    const result = calcularCotizacion({
      paxAdultos: 5,
      paxMenores: 2,
      metodoPago: "tarjeta",
      tcArsUsd: 1420,
      destinos: [
        {
          destino: "Iguazú",
          vueloIdaAdultoArs: 0,
          vueloIdaMenorArs: 0,
          vueloVueltaAdultoArs: 0,
          vueloVueltaMenorArs: 0,
          hotelNoches: 0,
          hotelAdultoNocheArs: 0,
          hotelMenorNocheArs: 0,
          // 3212.17 / 7 pax ≈ 458.8814 USD por pax con Mismo adulto
          excursiones: [
            baseExc({
              neto: 458.8814285714,
              moneda: "USD",
              politicaMenores: "Mismo adulto",
            }),
          ],
        },
      ],
    });

    expect(result.subtotalUsd).toBe(3212.17);
    expect(result.precioPaquete).toBe(4588.81);
    expect(result.precioPostFee).toBe(5047.69);
    expect(result.precioFinal).toBe(5313.36);
    expect(result.precioFinalCliente).toBe(5314);
  });
});

describe("calcularCotizacion — COT-0010 inputs ARS reconstruidos", () => {
  it("vuelos + hotel + 2 excursiones → precio final CEILING 5314", () => {
    // Reconstrucción desde Notas COT-0010:
    // - Vuelo roundtrip USD 233.90/pax → ARS 332.138/pax (todo en ida)
    // - Hotel total ARS 1.277.794 / 7 pax = ARS 182.542/pax
    // - PQT 01A ARS 48.200 + Cat BRA ARS 65.600 (Mismo adulto)
    const flightArs = 233.9 * 1420;
    const hotelArs = 1_277_794 / 7;

    const result = calcularCotizacion({
      paxAdultos: 5,
      paxMenores: 2,
      metodoPago: "tarjeta",
      tcArsUsd: 1420,
      destinos: [
        {
          destino: "Iguazú",
          vueloIdaAdultoArs: flightArs,
          vueloIdaMenorArs: flightArs,
          vueloVueltaAdultoArs: 0,
          vueloVueltaMenorArs: 0,
          hotelNoches: 1,
          hotelAdultoNocheArs: hotelArs,
          hotelMenorNocheArs: hotelArs,
          excursiones: [
            {
              id: "pqt01a",
              nombre: "PQT 01A",
              neto: 48_200,
              moneda: "ARS",
              precioMenor: null,
              politicaMenores: "Mismo adulto",
            },
            {
              id: "cat-bra",
              nombre: "Cataratas Brasileras + Aves",
              neto: 65_600,
              moneda: "ARS",
              precioMenor: null,
              politicaMenores: "Mismo adulto",
            },
          ],
        },
      ],
    });

    expect(result.subtotalUsd).toBeCloseTo(3212.17, 1);
    expect(result.precioFinalCliente).toBe(5314);
    expect(result.precioAdultoCliente).toBe(760);
    expect(result.precioMenorCliente).toBe(760);
  });

  it("5 nights × known rate → expected USD stay path", () => {
    // stay = 5 × 100_000 = 500_000 ARS → ÷1420 ÷0.97 → USD path
    const result = calcularCotizacion({
      paxAdultos: 1,
      paxMenores: 0,
      metodoPago: "efectivo",
      tcArsUsd: 1420,
      destinos: [
        {
          destino: "Iguazú",
          vueloIdaAdultoArs: 0,
          vueloIdaMenorArs: 0,
          vueloVueltaAdultoArs: 0,
          vueloVueltaMenorArs: 0,
          hotelNoches: 5,
          hotelAdultoNocheArs: 100_000,
          hotelMenorNocheArs: 0,
          excursiones: [],
        },
      ],
    });

    expect(result.destinos[0]?.hotelAdultoArsNet).toBe(500_000);
    // 500_000 / 1420 / (1-0.03) → halfUp2 363
    expect(result.subtotalUsd).toBe(363);
    // /0.7 agency → 518.57; /0.95 seller → 545.86; CEILING 546
    expect(result.precioFinalCliente).toBe(546);
  });
});
