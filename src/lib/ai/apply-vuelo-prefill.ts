import type { UseFormGetValues, UseFormSetValue } from "react-hook-form";
import {
  type FieldConfidenceMap,
  type OcrConfidence,
  resolveFieldConfidence,
} from "@/lib/ai/prefill-confidence";
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
  /** Confidence keyed by form path. */
  confidenceByPath: Record<string, OcrConfidence>;
  /**
   * When extract has prices but no destino[0] yet — prices are not written
   * anywhere; seller must select a destino (step 0) then re-upload or enter
   * prices manually under Vuelo on Cliente + Viaje.
   */
  skippedPricesWarning: string | null;
  /**
   * Spanish labels for fields skipped because the seller already filled them
   * (non-empty trip strings or positive prices). Empty when nothing was skipped.
   */
  skippedFilledLabels: string[];
};

function isNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Applies flight extract fields to the cotización form.
 * Does not touch client fields (nombre, WhatsApp, perfil, etc.).
 *
 * Prefill never overwrites non-empty trip strings or positive flight prices;
 * empty/zero fields may be filled. Moneda is not overwritten when destinos.0
 * already has any flight price > 0 (seller has currency context).
 */
export function applyVueloPrefill(
  fields: VueloExtractFields,
  setValue: UseFormSetValue<CotizacionFormInput>,
  getValues: UseFormGetValues<CotizacionFormInput>,
  confidence?: FieldConfidenceMap,
): ApplyVueloPrefillResult {
  const filledPaths: string[] = [];
  const confidenceByPath: Record<string, OcrConfidence> = {};
  const skippedFilledLabels: string[] = [];

  function recordPath(path: string, fieldKey: string): void {
    filledPaths.push(path);
    confidenceByPath[path] = resolveFieldConfidence(confidence, fieldKey);
  }

  function skipLabel(path: string): void {
    const label = VUELO_PREFILL_LABELS[path] ?? path;
    if (!skippedFilledLabels.includes(label)) {
      skippedFilledLabels.push(label);
    }
  }

  function setStringField(
    path: keyof CotizacionFormInput & string,
    value: string,
    confidenceKey: string,
  ): void {
    if (!value) return;
    setValue(path, value, { shouldDirty: true, shouldValidate: false });
    recordPath(path, confidenceKey);
  }

  for (const key of TRIP_STRING_KEYS) {
    const value = fields[key];
    if (typeof value !== "string" || value.length === 0) continue;
    if (isNonEmptyString(getValues(key))) {
      skipLabel(key);
      continue;
    }
    setStringField(key, value, key);
  }

  // Trip-level travel dates from segment dates when present
  if (fields.vueloIdaFecha) {
    if (isNonEmptyString(getValues("fechaIda"))) {
      skipLabel("fechaIda");
    } else {
      setStringField("fechaIda", fields.vueloIdaFecha, "vueloIdaFecha");
    }
  }
  if (fields.vueloVueltaFecha) {
    if (isNonEmptyString(getValues("fechaVuelta"))) {
      skipLabel("fechaVuelta");
    } else {
      setStringField(
        "fechaVuelta",
        fields.vueloVueltaFecha,
        "vueloVueltaFecha",
      );
    }
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
    let anyExistingPrice = false;
    for (const key of PRICE_KEYS) {
      const current = getValues(`destinos.0.${key}` as const);
      if (isPositiveNumber(current)) {
        anyExistingPrice = true;
      }
    }

    for (const key of PRICE_KEYS) {
      const value = fields[key];
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      const path = `destinos.0.${key}` as const;
      const current = getValues(path);
      if (isPositiveNumber(current)) {
        skipLabel(path);
        continue;
      }
      setValue(path, value, { shouldDirty: true, shouldValidate: false });
      recordPath(path, key);
    }

    // Skip moneda when seller already has flight price context on destinos.0.
    if (fields.moneda) {
      if (anyExistingPrice) {
        skipLabel("destinos.0.moneda");
      } else {
        setValue("destinos.0.moneda", fields.moneda, {
          shouldDirty: true,
          shouldValidate: false,
        });
        recordPath("destinos.0.moneda", "moneda");
      }
    }
  }

  const filledLabels = filledPaths.map(
    (path) => VUELO_PREFILL_LABELS[path] ?? path,
  );

  return {
    filledPaths,
    filledLabels,
    confidenceByPath,
    skippedPricesWarning,
    skippedFilledLabels,
  };
}
