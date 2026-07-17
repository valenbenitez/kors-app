import { catalog } from "@/lib/cotizador/catalog";
import type {
  CotizacionInput,
  DestinoCostInput,
  ExcursionInput,
} from "@/lib/cotizador/formula";
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
  const destinos: DestinoCostInput[] = form.destinos.map((d) => ({
    destino: d.destino,
    vueloIdaAdultoArs: d.vueloIdaAdultoArs,
    vueloIdaMenorArs: d.vueloIdaMenorArs,
    vueloVueltaAdultoArs: d.vueloVueltaAdultoArs,
    vueloVueltaMenorArs: d.vueloVueltaMenorArs,
    hotelAdultoArs: d.hotelAdultoArs,
    hotelMenorArs: d.hotelMenorArs,
    hotelAjusteArs: d.hotelAjusteArs || 0,
    hotelNombre: d.hotelNombre,
    hotelCategoria: d.hotelCategoria || undefined,
    hotelRegimen: d.hotelRegimen,
    hotelUbicacion: d.hotelUbicacion,
    hotelHabitacion: d.hotelHabitacion,
    hotelAjusteRazon: d.hotelAjusteRazon,
    excursiones: resolveExcursions(d.excursionIds),
  }));

  return {
    paxAdultos: form.paxAdultos,
    paxMenores: form.paxMenores,
    metodoPago: form.metodoPago,
    destinos,
  };
}
