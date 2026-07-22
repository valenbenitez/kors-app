import type { UseFormSetValue } from "react-hook-form";
import {
  type FieldConfidenceMap,
  type OcrConfidence,
  resolveFieldConfidence,
} from "@/lib/ai/prefill-confidence";
import type { HotelExtractFields } from "@/lib/ai/schemas";
import type { CotizacionFormInput } from "@/lib/validations/cotizacion";

/** Spanish UI labels for hotel destino fields filled by image prefill. */
export const HOTEL_PREFILL_LABELS: Record<string, string> = {
  hotelNombre: "Nombre hotel",
  hotelCategoria: "Categoría",
  hotelUbicacion: "Ubicación",
  hotelHabitacion: "Tipo habitación",
  hotelRegimen: "Régimen",
  hotelIncluye: "Hotel incluye",
  hotelExcluye: "Hotel excluye",
  hotelCondiciones: "Condiciones del hotel",
  hotelNoches: "Noches",
  hotelAdultoNocheArs: "Hotel adulto / noche",
  moneda: "Moneda del destino",
};

const HOTEL_STRING_KEYS = [
  "hotelNombre",
  "hotelCategoria",
  "hotelUbicacion",
  "hotelHabitacion",
  "hotelRegimen",
  "hotelIncluye",
  "hotelExcluye",
  "hotelCondiciones",
] as const satisfies ReadonlyArray<keyof HotelExtractFields>;

export type ApplyHotelPrefillResult = {
  /** Form paths that received a non-empty value. */
  filledPaths: string[];
  /** Spanish labels for UI feedback. */
  filledLabels: string[];
  /** Confidence keyed by form path (e.g. destinos.0.hotelNombre). */
  confidenceByPath: Record<string, OcrConfidence>;
};

function labelFor(fieldKey: string): string {
  return HOTEL_PREFILL_LABELS[fieldKey] ?? fieldKey;
}

/**
 * Applies hotel extract fields to a single destino in the cotización form.
 * Does not touch trip-level flight fields or other destinos.
 */
export function applyHotelPrefill(
  fields: HotelExtractFields,
  setValue: UseFormSetValue<CotizacionFormInput>,
  destinoIndex: number,
  confidence?: FieldConfidenceMap,
): ApplyHotelPrefillResult {
  if (!Number.isInteger(destinoIndex) || destinoIndex < 0) {
    return { filledPaths: [], filledLabels: [], confidenceByPath: {} };
  }

  const filledPaths: string[] = [];
  const confidenceByPath: Record<string, OcrConfidence> = {};

  function recordPath(path: string, fieldKey: string): void {
    filledPaths.push(path);
    confidenceByPath[path] = resolveFieldConfidence(confidence, fieldKey);
  }

  for (const key of HOTEL_STRING_KEYS) {
    const value = fields[key];
    if (typeof value === "string" && value.length > 0) {
      const path = `destinos.${destinoIndex}.${key}` as const;
      setValue(path, value, { shouldDirty: true, shouldValidate: false });
      recordPath(path, key);
    }
  }

  // API already computed hotelAdultoNocheArs = total ÷ pax ÷ nights (HALF_UP).
  // Skip 0 so we never wipe an existing seller price when nights/total unknown.
  if (
    typeof fields.hotelNoches === "number" &&
    Number.isFinite(fields.hotelNoches) &&
    fields.hotelNoches > 0
  ) {
    const path = `destinos.${destinoIndex}.hotelNoches` as const;
    setValue(path, fields.hotelNoches, {
      shouldDirty: true,
      shouldValidate: false,
    });
    recordPath(path, "hotelNoches");
  }

  if (
    typeof fields.hotelAdultoNocheArs === "number" &&
    Number.isFinite(fields.hotelAdultoNocheArs) &&
    fields.hotelAdultoNocheArs > 0
  ) {
    const path = `destinos.${destinoIndex}.hotelAdultoNocheArs` as const;
    setValue(path, fields.hotelAdultoNocheArs, {
      shouldDirty: true,
      shouldValidate: false,
    });
    recordPath(path, "hotelAdultoNocheArs");
  }

  if (fields.moneda) {
    const path = `destinos.${destinoIndex}.moneda` as const;
    setValue(path, fields.moneda, { shouldDirty: true, shouldValidate: false });
    recordPath(path, "moneda");
  }

  const filledLabels = filledPaths.map((path) => {
    const fieldKey = path.split(".").pop() ?? path;
    return labelFor(fieldKey);
  });

  return { filledPaths, filledLabels, confidenceByPath };
}
