import { describe, expect, it } from "vitest";
import {
  calcularCotizacion,
  type ExcursionInput,
  FormulaError,
} from "@/lib/cotizador/formula";

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
          hotelAdultoArs: 0,
          hotelMenorArs: 0,
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
          hotelAdultoArs: 0,
          hotelMenorArs: 0,
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
          hotelAdultoArs: 0,
          hotelMenorArs: 0,
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
            hotelAdultoArs: 0,
            hotelMenorArs: 0,
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
          hotelAdultoArs: 0,
          hotelMenorArs: 0,
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
            hotelAdultoArs: 0,
            hotelMenorArs: 0,
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
          hotelAdultoArs: 0,
          hotelMenorArs: 0,
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
          hotelAdultoArs: hotelArs,
          hotelMenorArs: hotelArs,
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
});
