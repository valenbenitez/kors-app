import { catalog } from "@/lib/cotizador/catalog";
import type {
  CotizacionInput,
  DestinoCostInput,
  ExcursionInput,
} from "@/lib/cotizador/formula";
import { FORMULA_PARAMS } from "@/lib/cotizador/params";
import type { CotizacionFormInput } from "@/lib/validations/cotizacion";

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
  const tc = FORMULA_PARAMS.tcArsUsd;

  const destinos: DestinoCostInput[] = form.destinos.map((d) => {
    // Los costos de vuelo/hotel se cargan en la moneda elegida por destino.
    // La fórmula trabaja en ARS: si el operador cargó en USD lo llevamos a
    // ARS-equivalente (× TC); la fórmula luego divide por TC.
    const toArs = (amount: number) =>
      d.moneda === "USD" ? amount * tc : amount;

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
