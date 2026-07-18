import Decimal from "decimal.js";
import { catalog } from "@/lib/cotizador/catalog";
import type {
  CotizacionInput,
  DestinoCostInput,
  ExcursionInput,
} from "@/lib/cotizador/formula";
import {
  FORMULA_PARAMS,
  FX_RATES_TO_USD,
  type FxCurrency,
} from "@/lib/cotizador/params";
import type {
  CotizacionFormInput,
  FormMoneda,
} from "@/lib/validations/cotizacion";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/**
 * Converts an amount in `moneda` to ARS-equivalent for the formula layer.
 * Path: local → USD (÷ rate) → ARS (× tcArsUsd), all via Decimal.
 */
export function amountToArs(amount: number, moneda: FormMoneda): number {
  const rate = FX_RATES_TO_USD[moneda as FxCurrency];
  const tc = new Decimal(FORMULA_PARAMS.tcArsUsd);
  return new Decimal(amount).div(rate).times(tc).toNumber();
}

/** Converts local currency amount to USD using the FX map (Decimal). */
export function amountToUsd(amount: number, moneda: FormMoneda): number {
  const rate = FX_RATES_TO_USD[moneda as FxCurrency];
  return new Decimal(amount).div(rate).toNumber();
}

export function resolveExcursions(ids: string[]): ExcursionInput[] {
  return ids.map((id) => {
    const found = catalog.find((e) => e.id === id);
    if (!found) {
      throw new Error(`Excursión no encontrada: ${id}`);
    }
    return {
      id: found.id,
      nombre: found.nombre,
      neto: found.neto,
      moneda: found.moneda,
      precioMenor: found.precioMenor,
      politicaMenores: found.politicaMenores,
    };
  });
}

export function formToFormulaInput(form: CotizacionFormInput): CotizacionInput {
  const destinos: DestinoCostInput[] = form.destinos.map((d) => {
    const toArs = (amount: number) => amountToArs(amount, d.moneda);

    return {
      destino: d.destino,
      vueloIdaAdultoArs: toArs(d.vueloIdaAdultoArs),
      vueloIdaMenorArs: toArs(d.vueloIdaMenorArs),
      vueloVueltaAdultoArs: toArs(d.vueloVueltaAdultoArs),
      vueloVueltaMenorArs: toArs(d.vueloVueltaMenorArs),
      hotelAdultoArs: toArs(d.hotelAdultoArs),
      hotelMenorArs: toArs(d.hotelMenorArs),
      hotelAjusteArs: toArs(d.hotelAjusteArs || 0),
      hotelNombre: d.hotelNombre,
      hotelCategoria: d.hotelCategoria || undefined,
      hotelRegimen: d.hotelRegimen,
      hotelUbicacion: d.hotelUbicacion,
      hotelHabitacion: d.hotelHabitacion,
      hotelAjusteRazon: d.hotelAjusteRazon,
      excursiones: resolveExcursions(d.excursionIds),
    };
  });

  return {
    paxAdultos: form.paxAdultos,
    paxMenores: form.paxMenores,
    metodoPago: form.metodoPago,
    destinos,
  };
}
