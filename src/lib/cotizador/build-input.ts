import Decimal from "decimal.js";
import { catalog } from "@/lib/cotizador/catalog";
import type {
  CotizacionInput,
  DestinoCostInput,
  ExcursionInput,
} from "@/lib/cotizador/formula";
import type { FxRatesMap } from "@/lib/cotizador/rates";
import type {
  CotizacionFormInput,
  FormMoneda,
} from "@/lib/validations/cotizacion";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/**
 * Converts an amount in `moneda` to ARS-equivalent for the formula layer.
 * Path: local → USD (÷ rate) → ARS (× rates.ARS), all via Decimal.
 */
export function amountToArs(
  amount: number,
  moneda: FormMoneda,
  rates: FxRatesMap,
): number {
  const rate = rates[moneda];
  const tc = new Decimal(rates.ARS);
  return new Decimal(amount).div(rate).times(tc).toNumber();
}

/** Converts local currency amount to USD using the FX map (Decimal). */
export function amountToUsd(
  amount: number,
  moneda: FormMoneda,
  rates: FxRatesMap,
): number {
  const rate = rates[moneda];
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

/**
 * Builds formula input from the wizard form using the provided FX rates.
 * Sets `tcArsUsd` from `rates.ARS` so the formula and conversion stay aligned.
 * When `clienteAportaVuelos` is true, flight prices are forced to 0 so residual
 * form values cannot inflate the package total.
 */
export function formToFormulaInput(
  form: CotizacionFormInput,
  rates: FxRatesMap,
): CotizacionInput {
  const zeroFlights = form.clienteAportaVuelos;
  const destinos: DestinoCostInput[] = form.destinos.map((d) => {
    const toArs = (amount: number) => amountToArs(amount, d.moneda, rates);

    return {
      destino: d.destino,
      vueloIdaAdultoArs: zeroFlights ? 0 : toArs(d.vueloIdaAdultoArs),
      vueloIdaMenorArs: zeroFlights ? 0 : toArs(d.vueloIdaMenorArs),
      vueloVueltaAdultoArs: zeroFlights ? 0 : toArs(d.vueloVueltaAdultoArs),
      vueloVueltaMenorArs: zeroFlights ? 0 : toArs(d.vueloVueltaMenorArs),
      hotelNoches: d.hotelNoches,
      hotelAdultoNocheArs: toArs(d.hotelAdultoNocheArs),
      hotelMenorNocheArs: toArs(d.hotelMenorNocheArs),
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
    tcArsUsd: rates.ARS,
  };
}
