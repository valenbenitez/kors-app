import Decimal from "decimal.js";
import {
  NothingUsableError,
  TypeMismatchError,
  UnreadableImageError,
} from "@/lib/ai/errors";
import type { HotelExtractFields, HotelLlmExtract } from "@/lib/ai/schemas";
import {
  type FormMoneda,
  HOTEL_CATEGORIAS,
  MONEDAS,
} from "@/lib/validations/cotizacion";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/**
 * Rounding policy for hotelAdultoArs:
 * `Decimal(total).div(paxAdultos)` with ROUND_HALF_UP to **0 decimal places**
 * (integer pesos). Matches MoneyField ARS/CLP/COP UI (decimals: 0).
 * Example: total 100_001 ÷ 2 → 50_001.
 */
export function computeHotelAdultoArs(
  total: number,
  paxAdultos: number,
): number {
  if (paxAdultos < 1) {
    throw new Error("paxAdultos must be >= 1");
  }
  return new Decimal(total)
    .div(paxAdultos)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
}

/**
 * Normalizes star strings to form categorías `"3★" | "4★" | "5★"`.
 * Unknown / empty → `""`.
 */
export function mapHotelCategoria(
  starsRaw: string,
): "" | (typeof HOTEL_CATEGORIAS)[number] {
  const trimmed = starsRaw.trim();
  if (!trimmed) return "";

  // Already in form format
  if ((HOTEL_CATEGORIAS as readonly string[]).includes(trimmed)) {
    return trimmed as (typeof HOTEL_CATEGORIAS)[number];
  }

  const lower = trimmed.toLowerCase();
  const match =
    lower.match(/([345])\s*[★*]/) ??
    lower.match(/([345])\s*(?:stars?|estrellas?)/) ??
    lower.match(/\b([345])\b/);

  if (!match) return "";

  const mapped = `${match[1]}★` as (typeof HOTEL_CATEGORIAS)[number];
  return (HOTEL_CATEGORIAS as readonly string[]).includes(mapped) ? mapped : "";
}

function normalizeMoneda(
  currency: string,
  fallback?: FormMoneda,
): FormMoneda | undefined {
  const upper = currency.trim().toUpperCase();
  if ((MONEDAS as readonly string[]).includes(upper)) {
    return upper as FormMoneda;
  }
  return fallback;
}

function hasUsableHotelIdentity(input: {
  hotelNombre: string;
  hotelCategoria: string;
  hotelUbicacion: string;
  hotelHabitacion: string;
  hotelIncluye: string;
  hotelExcluye: string;
  hotelCondiciones: string;
  hotelEstadiaDetalle: string;
  total: number;
}): boolean {
  return (
    input.hotelNombre.length > 0 ||
    input.hotelCategoria !== "" ||
    input.hotelUbicacion.length > 0 ||
    input.hotelHabitacion.length > 0 ||
    input.hotelIncluye.length > 0 ||
    input.hotelExcluye.length > 0 ||
    input.hotelCondiciones.length > 0 ||
    input.hotelEstadiaDetalle.length > 0 ||
    input.total > 0
  );
}

export type MapHotelInput = {
  llm: HotelLlmExtract;
  paxAdultos: number;
  moneda?: FormMoneda;
};

export type MapHotelResult = {
  fields: HotelExtractFields;
  warnings: string[];
};

/**
 * Maps LLM hotel extract → form prefill fields.
 * Throws named domain errors for unreadable / mismatch / empty extracts.
 */
export function mapHotelExtract(input: MapHotelInput): MapHotelResult {
  const { llm, paxAdultos, moneda } = input;

  if (!llm.isHotelDocument) {
    throw new TypeMismatchError(
      "Image does not look like a hotel booking or offer",
    );
  }

  const hotelNombre = llm.name.trim();
  const hotelCategoria = mapHotelCategoria(llm.starsRaw);
  const hotelUbicacion = llm.ubicacion.trim();
  const hotelHabitacion = llm.roomType.trim();
  const hotelRegimen = llm.regimen.trim();
  const hotelIncluye = llm.includes.trim();
  const hotelExcluye = llm.excludes.trim();
  const hotelCondiciones = llm.conditions.trim();
  const hotelEstadiaDetalle = llm.stayDetail.trim();
  const total =
    llm.totalPrice != null &&
    Number.isFinite(llm.totalPrice) &&
    llm.totalPrice > 0
      ? llm.totalPrice
      : 0;

  const hasIdentity = hasUsableHotelIdentity({
    hotelNombre,
    hotelCategoria,
    hotelUbicacion,
    hotelHabitacion,
    hotelIncluye,
    hotelExcluye,
    hotelCondiciones,
    hotelEstadiaDetalle,
    total,
  });

  // Prefer usable extract over a false-negative imageReadable flag.
  if (!llm.imageReadable) {
    if (!hasIdentity) {
      throw new UnreadableImageError("Hotel image is unreadable");
    }
  } else if (!hasIdentity) {
    throw new NothingUsableError("Hotel extract produced no usable fields");
  }

  const hotelAdultoArs =
    total > 0 ? computeHotelAdultoArs(total, paxAdultos) : 0;

  const warnings = [...llm.warnings];
  if (!llm.imageReadable && hasIdentity) {
    warnings.push(
      "El modelo marcó la imagen como poco legible, pero se extrajeron datos de hotel útiles.",
    );
  }
  if (total > 0) {
    warnings.push(
      `Precio por adulto = total ${total} ÷ ${paxAdultos} adultos (redondeo HALF_UP a entero)`,
    );
  }
  if (hotelEstadiaDetalle) {
    warnings.push(`Estadía detectada: ${hotelEstadiaDetalle}`);
  }

  const resolvedMoneda = normalizeMoneda(llm.currency, moneda);

  const fields: HotelExtractFields = {
    hotelNombre,
    hotelCategoria,
    hotelUbicacion,
    hotelHabitacion,
    hotelRegimen,
    hotelIncluye,
    hotelExcluye,
    hotelCondiciones,
    hotelAdultoArs,
    hotelTotalDetectado: total,
    hotelEstadiaDetalle,
    ...(resolvedMoneda ? { moneda: resolvedMoneda } : {}),
  };

  return { fields, warnings };
}
