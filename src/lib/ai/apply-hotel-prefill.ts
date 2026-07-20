import type { UseFormSetValue } from "react-hook-form";
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
  hotelAdultoArs: "Hotel por adulto",
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
): ApplyHotelPrefillResult {
  if (!Number.isInteger(destinoIndex) || destinoIndex < 0) {
    return { filledPaths: [], filledLabels: [] };
  }

  const filledPaths: string[] = [];

  for (const key of HOTEL_STRING_KEYS) {
    const value = fields[key];
    if (typeof value === "string" && value.length > 0) {
      const path = `destinos.${destinoIndex}.${key}` as const;
      setValue(path, value, { shouldDirty: true, shouldValidate: false });
      filledPaths.push(path);
    }
  }

  // API already computed hotelAdultoArs = total ÷ paxAdultos (HALF_UP integer).
  // Skip 0 so we never wipe an existing seller price when total was unknown.
  if (
    typeof fields.hotelAdultoArs === "number" &&
    Number.isFinite(fields.hotelAdultoArs) &&
    fields.hotelAdultoArs > 0
  ) {
    const path = `destinos.${destinoIndex}.hotelAdultoArs` as const;
    setValue(path, fields.hotelAdultoArs, {
      shouldDirty: true,
      shouldValidate: false,
    });
    filledPaths.push(path);
  }

  if (fields.moneda) {
    const path = `destinos.${destinoIndex}.moneda` as const;
    setValue(path, fields.moneda, { shouldDirty: true, shouldValidate: false });
    filledPaths.push(path);
  }

  const filledLabels = filledPaths.map((path) => {
    const fieldKey = path.split(".").pop() ?? path;
    return labelFor(fieldKey);
  });

  return { filledPaths, filledLabels };
}
