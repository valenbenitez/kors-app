import { describe, expect, test } from "vitest";
import type { FormulaResult } from "@/lib/cotizador/formula";
import { computePremiumTag } from "@/lib/cotizador/premium";
import type { CotizacionFormInput } from "@/lib/validations/cotizacion";

const baseForm = {
  clienteNombre: "Ana",
  perfil: "Pareja",
  destinos: [
    {
      destino: "Misiones",
      excursionIds: [] as string[],
    },
  ],
} as CotizacionFormInput;

function result(overrides: Partial<FormulaResult> = {}): FormulaResult {
  return {
    tcArsUsd: 1420,
    subtotalUsd: 100,
    subtotalAdultosUsd: 100,
    subtotalMenoresUsd: 0,
    precioPaquete: 110,
    margenAgenciaUsd: 10,
    precioPostFee: 120,
    precioFinal: 120,
    margenVendedorUsd: 5,
    precioFinalCliente: 125,
    precioAdultoCliente: 62,
    precioMenorCliente: 0,
    destinos: [],
    ...overrides,
  };
}

describe("computePremiumTag", () => {
  test("true when precio final >= 3000", () => {
    expect(
      computePremiumTag(baseForm, result({ precioFinalCliente: 3000 })),
    ).toBe(true);
  });

  test("false when below thresholds and no excursions", () => {
    expect(computePremiumTag(baseForm, result())).toBe(false);
  });
});
