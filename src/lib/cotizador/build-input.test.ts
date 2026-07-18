import { describe, expect, it } from "vitest";
import {
  amountToArs,
  amountToUsd,
  formToFormulaInput,
} from "@/lib/cotizador/build-input";
import { calcularCotizacion } from "@/lib/cotizador/formula";
import { FORMULA_PARAMS, FX_RATES_TO_USD } from "@/lib/cotizador/params";
import { renderPdfHtml } from "@/lib/pdf/template";
import type { CotizacionFormInput } from "@/lib/validations/cotizacion";

function minimalForm(
  overrides: Partial<CotizacionFormInput> & {
    destinos: CotizacionFormInput["destinos"];
  },
): CotizacionFormInput {
  return {
    clienteNombre: "Test Client",
    paisOrigen: "Chile",
    whatsapp: "+56912345678",
    perfil: "Pareja",
    destinosSeleccionados: ["Bariloche"],
    fechaIda: "2027-06-01",
    fechaVuelta: "2027-06-08",
    paxAdultos: 1,
    paxMenores: 0,
    edadesMenores: [],
    metodoPago: "efectivo",
    equipaje: "carry-on",
    aerolinea: "LATAM",
    itinerario: "Día 1: llegada",
    ...overrides,
  };
}

describe("FX_RATES_TO_USD", () => {
  it("keeps ARS rate equal to tcArsUsd for regression", () => {
    expect(FX_RATES_TO_USD.ARS).toBe(FORMULA_PARAMS.tcArsUsd);
    expect(FX_RATES_TO_USD.USD).toBe(1);
  });
});

describe("amountToUsd / amountToArs", () => {
  it("converts CLP via Decimal rate (950 CLP = 1 USD)", () => {
    expect(amountToUsd(950_000, "CLP")).toBe(1000);
    expect(amountToArs(950_000, "CLP")).toBe(1000 * FORMULA_PARAMS.tcArsUsd);
  });

  it("leaves ARS unchanged when converting to ARS", () => {
    expect(amountToArs(142_000, "ARS")).toBe(142_000);
    expect(amountToUsd(142_000, "ARS")).toBe(100);
  });

  it("converts USD to ARS with tcArsUsd", () => {
    expect(amountToArs(100, "USD")).toBe(100 * FORMULA_PARAMS.tcArsUsd);
  });
});

describe("formToFormulaInput — multi-currency → USD final", () => {
  it("CLP hotel cost (known amount × rate) yields expected USD client total", () => {
    // 950_000 CLP @ 950 = 1000 USD hotel before tax.
    // hotelAdj = 1000 / 0.97 → agency /0.7 → seller /0.95 → CEILING
    const form = minimalForm({
      destinos: [
        {
          destino: "Bariloche",
          moneda: "CLP",
          vueloIdaAdultoArs: 0,
          vueloIdaMenorArs: 0,
          vueloVueltaAdultoArs: 0,
          vueloVueltaMenorArs: 0,
          hotelAdultoArs: 950_000,
          hotelMenorArs: 0,
          hotelNombre: "Hotel Test",
          hotelCategoria: "4★",
          hotelRegimen: "desayuno",
          hotelUbicacion: "Centro",
          hotelHabitacion: "Doble",
          hotelAjusteArs: 0,
          hotelAjusteRazon: "",
          excursionIds: [],
        },
      ],
    });

    const input = formToFormulaInput(form);
    expect(input.destinos[0].hotelAdultoArs).toBe(
      1000 * FORMULA_PARAMS.tcArsUsd,
    );

    const result = calcularCotizacion(input);

    // 1000 / 0.97 = 1030.927835… → halfUp2 chain
    expect(result.subtotalUsd).toBe(1030.93);
    expect(result.precioPaquete).toBe(1472.76);
    expect(result.precioFinal).toBe(1550.27);
    expect(result.precioFinalCliente).toBe(1551);
    expect(result.precioAdultoCliente).toBe(1551);
  });

  it("COP flight cost converts and PDF HTML totals stay in USD (not COP)", () => {
    // 4_100_000 COP @ 4100 = 1000 USD flight before tax.
    const form = minimalForm({
      paisOrigen: "Colombia",
      destinos: [
        {
          destino: "Bariloche",
          moneda: "COP",
          vueloIdaAdultoArs: 4_100_000,
          vueloIdaMenorArs: 0,
          vueloVueltaAdultoArs: 0,
          vueloVueltaMenorArs: 0,
          hotelAdultoArs: 0,
          hotelMenorArs: 0,
          hotelNombre: "Hotel COP",
          hotelCategoria: "3★",
          hotelRegimen: "solo alojamiento",
          hotelUbicacion: "Centro",
          hotelHabitacion: "Simple",
          hotelAjusteArs: 0,
          hotelAjusteRazon: "",
          excursionIds: [],
        },
      ],
    });

    const result = calcularCotizacion(formToFormulaInput(form));
    // 1000 / 0.95 = 1052.631578… → halfUp2
    expect(result.subtotalUsd).toBe(1052.63);
    expect(result.precioFinalCliente).toBeGreaterThan(0);

    const fmt = (n: number) =>
      new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n);

    const html = renderPdfHtml({
      cotNumber: "COT-9901",
      form,
      result,
      generatedAt: "2027-06-01",
    });

    expect(html).toContain(`USD ${fmt(result.precioFinalCliente)}`);
    expect(html).toContain(`USD ${fmt(result.precioAdultoCliente)}`);
    expect(html).toMatch(/Precios en USD/i);
    // Total lines must not present the final price as COP
    expect(html).not.toContain(`COP ${fmt(result.precioFinalCliente)}`);
    expect(html).not.toMatch(/Total general[\s\S]{0,200}COP/);
  });
});
