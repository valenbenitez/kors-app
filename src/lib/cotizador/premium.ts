import { catalog } from "@/lib/cotizador/catalog";
import type { FormulaResult } from "@/lib/cotizador/formula";
import type { CotizacionFormInput } from "@/lib/validations/cotizacion";

/** Spec §6.1: excursion NETO ≥ USD 200/pax. */
export const PREMIUM_EXCURSION_NETO_USD = 200;

/** Spec §6.1: final client price ≥ USD 3000. */
export const PREMIUM_TOTAL_USD = 3000;

/**
 * Package is premium if any selected excursion NETO ≥ USD 200/pax
 * (ARS converted with the quote TC) OR precio final cliente ≥ USD 3000.
 */
export function computePremiumTag(
  form: CotizacionFormInput,
  result: FormulaResult,
): boolean {
  if (result.precioFinalCliente >= PREMIUM_TOTAL_USD) {
    return true;
  }

  const tc = result.tcArsUsd > 0 ? result.tcArsUsd : 1;

  for (const dest of form.destinos) {
    for (const id of dest.excursionIds) {
      const exc = catalog.find((row) => row.id === id);
      if (!exc) continue;
      const netoUsd = exc.moneda === "USD" ? exc.neto : exc.neto / tc;
      if (netoUsd >= PREMIUM_EXCURSION_NETO_USD) {
        return true;
      }
    }
  }

  return false;
}
