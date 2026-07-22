import {
  NothingUsableError,
  TypeMismatchError,
  UnreadableImageError,
} from "@/lib/ai/errors";
import type {
  FieldConfidenceMap,
  OcrConfidence,
} from "@/lib/ai/prefill-confidence";
import type { VueloExtractFields, VueloLlmExtract } from "@/lib/ai/schemas";
import type { FormMoneda } from "@/lib/validations/cotizacion";
import { MONEDAS } from "@/lib/validations/cotizacion";

const IATA_RE = /^[A-Za-z]{3}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** LLM `_confidence` keys → form field keys. */
const VUELO_LLM_TO_FORM: Record<string, keyof VueloExtractFields> = {
  airline: "aerolinea",
  idaFecha: "vueloIdaFecha",
  idaHoraSalida: "vueloIdaHoraSalida",
  idaHoraLlegada: "vueloIdaHoraLlegada",
  idaNumero: "vueloIdaNumero",
  idaAeropuertoSalida: "vueloIdaAeropuertoSalida",
  idaAeropuertoLlegada: "vueloIdaAeropuertoLlegada",
  vueltaFecha: "vueloVueltaFecha",
  vueltaHoraSalida: "vueloVueltaHoraSalida",
  vueltaHoraLlegada: "vueloVueltaHoraLlegada",
  vueltaNumero: "vueloVueltaNumero",
  vueltaAeropuertoSalida: "vueloVueltaAeropuertoSalida",
  vueltaAeropuertoLlegada: "vueloVueltaAeropuertoLlegada",
  precioIdaAdulto: "vueloIdaAdultoArs",
  precioIdaMenor: "vueloIdaMenorArs",
  precioVueltaAdulto: "vueloVueltaAdultoArs",
  precioVueltaMenor: "vueloVueltaMenorArs",
  currency: "moneda",
};

function setConfidence(
  map: FieldConfidenceMap,
  fieldKey: string,
  level: OcrConfidence | undefined,
): void {
  if (!level) return;
  map[fieldKey] = level;
}

/**
 * Normalizes airport codes to uppercase IATA (3 letters).
 * Empty string if unknown / not a valid IATA — never invents codes.
 */
export function normalizeIata(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  // Prefer an embedded 3-letter code (e.g. "Buenos Aires (EZE)")
  const paren = trimmed.match(/\(([A-Za-z]{3})\)/);
  if (paren) return paren[1].toUpperCase();

  const token = trimmed.split(/[\s,/|-]+/)[0] ?? "";
  if (IATA_RE.test(token)) return token.toUpperCase();

  if (IATA_RE.test(trimmed)) return trimmed.toUpperCase();

  return "";
}

/** Keep YYYY-MM-DD only; never invent dates from partial text. */
export function normalizeFlightDate(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (DATE_RE.test(trimmed)) return trimmed;
  return "";
}

/** Normalize to HH:mm when possible; empty if unusable. */
export function normalizeFlightTime(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
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

function optionalPrice(value: number | null | undefined): number | undefined {
  if (value == null || !Number.isFinite(value) || value < 0) return undefined;
  return value;
}

function hasUsableVueloFields(
  fields: VueloExtractFields,
  prices: {
    idaAdulto?: number;
    vueltaAdulto?: number;
  },
): boolean {
  return (
    fields.aerolinea.length > 0 ||
    fields.vueloIdaFecha.length > 0 ||
    fields.vueloIdaNumero.length > 0 ||
    fields.vueloIdaAeropuertoSalida.length > 0 ||
    fields.vueloIdaAeropuertoLlegada.length > 0 ||
    fields.vueloVueltaFecha.length > 0 ||
    fields.vueloVueltaNumero.length > 0 ||
    fields.vueloVueltaAeropuertoSalida.length > 0 ||
    fields.vueloVueltaAeropuertoLlegada.length > 0 ||
    prices.idaAdulto !== undefined ||
    prices.vueltaAdulto !== undefined
  );
}

export type MapVueloInput = {
  llm: VueloLlmExtract;
  moneda?: FormMoneda;
};

export type MapVueloResult = {
  fields: VueloExtractFields;
  warnings: string[];
  /** Form-field-keyed OCR confidence for the API `_confidence` payload. */
  _confidence: FieldConfidenceMap;
};

/**
 * Maps LLM flight extract → trip-level form fields (`vueloIda*` / `vueloVuelta*`).
 */
export function mapVueloExtract(input: MapVueloInput): MapVueloResult {
  const { llm, moneda } = input;

  if (!llm.isFlightDocument) {
    throw new TypeMismatchError("Image does not look like a flight itinerary");
  }

  const fields: VueloExtractFields = {
    aerolinea: llm.airline.trim(),
    vueloIdaFecha: normalizeFlightDate(llm.idaFecha),
    vueloIdaHoraSalida: normalizeFlightTime(llm.idaHoraSalida),
    vueloIdaHoraLlegada: normalizeFlightTime(llm.idaHoraLlegada),
    vueloIdaNumero: llm.idaNumero.trim(),
    vueloIdaAeropuertoSalida: normalizeIata(llm.idaAeropuertoSalida),
    vueloIdaAeropuertoLlegada: normalizeIata(llm.idaAeropuertoLlegada),
    vueloVueltaFecha: normalizeFlightDate(llm.vueltaFecha),
    vueloVueltaHoraSalida: normalizeFlightTime(llm.vueltaHoraSalida),
    vueloVueltaHoraLlegada: normalizeFlightTime(llm.vueltaHoraLlegada),
    vueloVueltaNumero: llm.vueltaNumero.trim(),
    vueloVueltaAeropuertoSalida: normalizeIata(llm.vueltaAeropuertoSalida),
    vueloVueltaAeropuertoLlegada: normalizeIata(llm.vueltaAeropuertoLlegada),
  };

  const idaAdulto = optionalPrice(llm.precioIdaAdulto);
  const idaMenor = optionalPrice(llm.precioIdaMenor);
  const vueltaAdulto = optionalPrice(llm.precioVueltaAdulto);
  const vueltaMenor = optionalPrice(llm.precioVueltaMenor);

  if (idaAdulto !== undefined) fields.vueloIdaAdultoArs = idaAdulto;
  if (idaMenor !== undefined) fields.vueloIdaMenorArs = idaMenor;
  if (vueltaAdulto !== undefined) fields.vueloVueltaAdultoArs = vueltaAdulto;
  if (vueltaMenor !== undefined) fields.vueloVueltaMenorArs = vueltaMenor;

  const resolvedMoneda = normalizeMoneda(llm.currency, moneda);
  if (resolvedMoneda) fields.moneda = resolvedMoneda;

  const hasUsable = hasUsableVueloFields(fields, { idaAdulto, vueltaAdulto });

  // Prefer usable extract over a false-negative imageReadable flag
  // (e.g. dark Matrix UI marked unreadable despite clear flight data).
  if (!llm.imageReadable) {
    if (!hasUsable) {
      throw new UnreadableImageError("Flight image is unreadable");
    }
  } else if (!hasUsable) {
    throw new NothingUsableError("Flight extract produced no usable fields");
  }

  const warnings = [...llm.warnings];
  if (!llm.imageReadable && hasUsable) {
    warnings.push(
      "El modelo marcó la imagen como poco legible, pero se extrajeron datos de vuelo útiles.",
    );
  }

  // Warn when raw airport text was dropped (not inventing IATA)
  if (llm.idaAeropuertoSalida.trim() && !fields.vueloIdaAeropuertoSalida) {
    warnings.push(
      `Aeropuerto ida salida no es IATA válido: "${llm.idaAeropuertoSalida.trim()}"`,
    );
  }
  if (llm.idaAeropuertoLlegada.trim() && !fields.vueloIdaAeropuertoLlegada) {
    warnings.push(
      `Aeropuerto ida llegada no es IATA válido: "${llm.idaAeropuertoLlegada.trim()}"`,
    );
  }
  if (llm.idaFecha.trim() && !fields.vueloIdaFecha) {
    warnings.push(
      `Fecha ida no es YYYY-MM-DD legible: "${llm.idaFecha.trim()}" (no se inventó)`,
    );
  }
  if (llm.vueltaFecha.trim() && !fields.vueloVueltaFecha) {
    warnings.push(
      `Fecha vuelta no es YYYY-MM-DD legible: "${llm.vueltaFecha.trim()}" (no se inventó)`,
    );
  }

  const llmConf = llm._confidence ?? {};
  const _confidence: FieldConfidenceMap = {};

  for (const [llmKey, formKey] of Object.entries(VUELO_LLM_TO_FORM)) {
    const level = llmConf[llmKey as keyof typeof llmConf];
    if (!level) continue;
    const value = fields[formKey];
    const filled =
      (typeof value === "string" && value.length > 0) ||
      (typeof value === "number" && Number.isFinite(value));
    if (filled) {
      setConfidence(_confidence, formKey, level);
    }
  }

  return { fields, warnings, _confidence };
}
