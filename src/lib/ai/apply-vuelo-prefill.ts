import type { UseFormGetValues, UseFormSetValue } from "react-hook-form";
import type { VueloExtractFields } from "@/lib/ai/schemas";
import type { CotizacionFormInput } from "@/lib/validations/cotizacion";

/** Spanish UI labels for fields that may be filled by flight image prefill. */
export const VUELO_PREFILL_LABELS: Record<string, string> = {
  fechaIda: "Fecha ida",
  fechaVuelta: "Fecha vuelta",
  aerolinea: "Aerolínea",
  vueloIdaFecha: "Fecha vuelo ida",
  vueloIdaHoraSalida: "Hora salida ida",
  vueloIdaHoraLlegada: "Hora llegada ida",
  vueloIdaNumero: "Número de vuelo ida",
  vueloIdaAeropuertoSalida: "Aeropuerto salida ida",
  vueloIdaAeropuertoLlegada: "Aeropuerto llegada ida",
  vueloVueltaFecha: "Fecha vuelo vuelta",
  vueloVueltaHoraSalida: "Hora salida vuelta",
  vueloVueltaHoraLlegada: "Hora llegada vuelta",
  vueloVueltaNumero: "Número de vuelo vuelta",
  vueloVueltaAeropuertoSalida: "Aeropuerto salida vuelta",
  vueloVueltaAeropuertoLlegada: "Aeropuerto llegada vuelta",
  "destinos.0.vueloIdaAdultoArs": "Precio ida adulto",
  "destinos.0.vueloIdaMenorArs": "Precio ida menor",
  "destinos.0.vueloVueltaAdultoArs": "Precio vuelta adulto",
  "destinos.0.vueloVueltaMenorArs": "Precio vuelta menor",
  "destinos.0.moneda": "Moneda del destino",
};

const TRIP_STRING_KEYS = [
  "aerolinea",
  "vueloIdaFecha",
  "vueloIdaHoraSalida",
  "vueloIdaHoraLlegada",
  "vueloIdaNumero",
  "vueloIdaAeropuertoSalida",
  "vueloIdaAeropuertoLlegada",
  "vueloVueltaFecha",
  "vueloVueltaHoraSalida",
  "vueloVueltaHoraLlegada",
  "vueloVueltaNumero",
  "vueloVueltaAeropuertoSalida",
  "vueloVueltaAeropuertoLlegada",
] as const satisfies ReadonlyArray<keyof VueloExtractFields>;

const PRICE_KEYS = [
  "vueloIdaAdultoArs",
  "vueloIdaMenorArs",
  "vueloVueltaAdultoArs",
  "vueloVueltaMenorArs",
] as const satisfies ReadonlyArray<keyof VueloExtractFields>;

export type ApplyVueloPrefillResult = {
  /** Form paths that received a non-empty value. */
  filledPaths: string[];
  /** Spanish labels for UI feedback. */
  filledLabels: string[];
  /**
   * When extract has prices but no destino[0] yet — prices are not written
   * anywhere; seller must select a destino (step 0) then re-upload or enter
   * prices manually under Vuelo on Cliente + Viaje.
   */
  skippedPricesWarning: string | null;
};

function setStringField(
  setValue: UseFormSetValue<CotizacionFormInput>,
  path: keyof CotizacionFormInput & string,
  value: string,
  filled: string[],
): void {
  if (!value) return;
  setValue(path, value, { shouldDirty: true, shouldValidate: false });
  filled.push(path);
}

/**
 * Applies flight extract fields to the cotización form.
 * Does not touch client fields (nombre, WhatsApp, perfil, etc.).
 */
export function applyVueloPrefill(
  fields: VueloExtractFields,
  setValue: UseFormSetValue<CotizacionFormInput>,
  getValues: UseFormGetValues<CotizacionFormInput>,
): ApplyVueloPrefillResult {
  const filledPaths: string[] = [];

  for (const key of TRIP_STRING_KEYS) {
    const value = fields[key];
    if (typeof value === "string" && value.length > 0) {
      setStringField(setValue, key, value, filledPaths);
    }
  }

  // Trip-level travel dates from segment dates when present
  if (fields.vueloIdaFecha) {
    setStringField(setValue, "fechaIda", fields.vueloIdaFecha, filledPaths);
  }
  if (fields.vueloVueltaFecha) {
    setStringField(
      setValue,
      "fechaVuelta",
      fields.vueloVueltaFecha,
      filledPaths,
    );
  }

  const hasPrice =
    fields.vueloIdaAdultoArs !== undefined ||
    fields.vueloIdaMenorArs !== undefined ||
    fields.vueloVueltaAdultoArs !== undefined ||
    fields.vueloVueltaMenorArs !== undefined;

  const destinos = getValues("destinos") ?? [];
  const hasDestino = destinos.length > 0;
  let skippedPricesWarning: string | null = null;

  if (hasPrice && !hasDestino) {
    skippedPricesWarning =
      "Se detectaron precios de vuelo, pero no hay destino seleccionado. Los precios no se guardaron: seleccioná un destino y volvé a subir la imagen, o cargalos a mano en Cliente + Viaje (sección Vuelo).";
  }

  if (hasPrice && hasDestino) {
    for (const key of PRICE_KEYS) {
      const value = fields[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        const path = `destinos.0.${key}` as const;
        setValue(path, value, { shouldDirty: true, shouldValidate: false });
        filledPaths.push(path);
      }
    }
    if (fields.moneda) {
      setValue("destinos.0.moneda", fields.moneda, {
        shouldDirty: true,
        shouldValidate: false,
      });
      filledPaths.push("destinos.0.moneda");
    }
  }

  const filledLabels = filledPaths.map(
    (path) => VUELO_PREFILL_LABELS[path] ?? path,
  );

  return { filledPaths, filledLabels, skippedPricesWarning };
}
