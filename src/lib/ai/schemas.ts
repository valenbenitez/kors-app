import { z } from "zod";
import {
  fieldConfidenceMapSchema,
  ocrConfidenceSchema,
} from "@/lib/ai/prefill-confidence";
import { HOTEL_CATEGORIAS, MONEDAS } from "@/lib/validations/cotizacion";

export const EXTRACT_TIPOS = ["hotel", "vuelo"] as const;
export type ExtractTipo = (typeof EXTRACT_TIPOS)[number];

export {
  type FieldConfidenceMap,
  fieldConfidenceMapSchema,
  OCR_CONFIDENCE_LEVELS,
  type OcrConfidence,
  ocrConfidenceSchema,
} from "@/lib/ai/prefill-confidence";

/** Empty string when the model omits a free-text field (e.g. Nova-lite). */
const llmString = (description: string) =>
  z.string().default("").describe(description);

/** Null when the model omits a nullable number. */
const llmNullableNumber = (description: string) =>
  z.number().nullable().default(null).describe(description);

const optionalConfidence = ocrConfidenceSchema.optional();

/** Per-field OCR confidence on raw LLM hotel keys. */
export const hotelLlmConfidenceSchema = z
  .object({
    name: optionalConfidence,
    starsRaw: optionalConfidence,
    totalPrice: optionalConfidence,
    currency: optionalConfidence,
    ubicacion: optionalConfidence,
    stayDetail: optionalConfidence,
    roomType: optionalConfidence,
    regimen: optionalConfidence,
    includes: optionalConfidence,
    excludes: optionalConfidence,
    conditions: optionalConfidence,
  })
  .default({});

/** Per-field OCR confidence on raw LLM flight keys. */
export const vueloLlmConfidenceSchema = z
  .object({
    airline: optionalConfidence,
    idaFecha: optionalConfidence,
    idaHoraSalida: optionalConfidence,
    idaHoraLlegada: optionalConfidence,
    idaNumero: optionalConfidence,
    idaAeropuertoSalida: optionalConfidence,
    idaAeropuertoLlegada: optionalConfidence,
    vueltaFecha: optionalConfidence,
    vueltaHoraSalida: optionalConfidence,
    vueltaHoraLlegada: optionalConfidence,
    vueltaNumero: optionalConfidence,
    vueltaAeropuertoSalida: optionalConfidence,
    vueltaAeropuertoLlegada: optionalConfidence,
    precioIdaAdulto: optionalConfidence,
    precioIdaMenor: optionalConfidence,
    precioVueltaAdulto: optionalConfidence,
    precioVueltaMenor: optionalConfidence,
    currency: optionalConfidence,
  })
  .default({});

/** Raw LLM hotel extraction — free-form stars / prices before mapping. */
export const hotelLlmSchema = z.object({
  imageReadable: z
    .boolean()
    .describe(
      "False ONLY if blank/corrupted/completely illegible. Dark mode, dense tables, and wide screenshots are still readable (true).",
    ),
  isHotelDocument: z
    .boolean()
    .describe("True only if the image is a hotel booking / offer screenshot"),
  name: llmString("Hotel name; empty string if unknown"),
  starsRaw: llmString(
    'Stars as seen, e.g. "4 stars", "4*", "4 estrellas"; empty if unknown',
  ),
  totalPrice: llmNullableNumber(
    "Total stay price as a number; null if not visible",
  ),
  currency: llmString(
    "Currency code if visible (ARS, USD, …); empty if unknown",
  ),
  ubicacion: llmString("Location / neighborhood; empty if unknown"),
  stayDetail: llmString(
    "Stay detail as readable text (nights, guests, check-in/out); empty if unknown",
  ),
  roomType: llmString("Room type; empty if unknown"),
  regimen: llmString(
    "Meal plan / régimen (desayuno, all inclusive, …); empty if unknown",
  ),
  includes: llmString("What is included; empty if unknown"),
  excludes: llmString("What is excluded; empty if unknown"),
  conditions: llmString("Booking conditions / policies; empty if unknown"),
  warnings: z
    .array(z.string())
    .default([])
    .describe("Ambiguities or low-confidence notes for the seller"),
  _confidence: hotelLlmConfidenceSchema.describe(
    "Per-field OCR confidence (high|medium|low) for each extracted value you filled. Omit keys for empty fields.",
  ),
});

export type HotelLlmExtract = z.infer<typeof hotelLlmSchema>;

/** Raw LLM flight extraction — before IATA / date normalization. */
export const vueloLlmSchema = z.object({
  imageReadable: z
    .boolean()
    .describe(
      "False ONLY if blank/corrupted/completely illegible. Dark Matrix/ITA UIs and dense fare grids are still readable (true).",
    ),
  isFlightDocument: z
    .boolean()
    .describe(
      "True only if the image is a flight itinerary / Matrix screenshot",
    ),
  airline: llmString("Airline name; empty if unknown"),
  idaFecha: llmString(
    "Outbound date YYYY-MM-DD; empty if unknown — never invent",
  ),
  idaHoraSalida: llmString("Outbound departure HH:mm; empty if unknown"),
  idaHoraLlegada: llmString("Outbound arrival HH:mm; empty if unknown"),
  idaNumero: llmString("Outbound flight number; empty if unknown"),
  idaAeropuertoSalida: llmString(
    "Outbound departure airport IATA or name; empty if unknown",
  ),
  idaAeropuertoLlegada: llmString(
    "Outbound arrival airport IATA or name; empty if unknown",
  ),
  vueltaFecha: llmString(
    "Return date YYYY-MM-DD; empty if unknown — never invent",
  ),
  vueltaHoraSalida: llmString("Return departure HH:mm; empty if unknown"),
  vueltaHoraLlegada: llmString("Return arrival HH:mm; empty if unknown"),
  vueltaNumero: llmString("Return flight number; empty if unknown"),
  vueltaAeropuertoSalida: llmString(
    "Return departure airport IATA or name; empty if unknown",
  ),
  vueltaAeropuertoLlegada: llmString(
    "Return arrival airport IATA or name; empty if unknown",
  ),
  precioIdaAdulto: llmNullableNumber(
    "Outbound adult price if visible; null otherwise",
  ),
  precioIdaMenor: llmNullableNumber(
    "Outbound child price if visible; null otherwise",
  ),
  precioVueltaAdulto: llmNullableNumber(
    "Return adult price if visible; null otherwise",
  ),
  precioVueltaMenor: llmNullableNumber(
    "Return child price if visible; null otherwise",
  ),
  currency: llmString("Currency if prices visible; empty if unknown"),
  warnings: z
    .array(z.string())
    .default([])
    .describe("Ambiguities or low-confidence notes for the seller"),
  _confidence: vueloLlmConfidenceSchema.describe(
    "Per-field OCR confidence (high|medium|low) for each extracted value you filled. Omit keys for empty fields.",
  ),
});

export type VueloLlmExtract = z.infer<typeof vueloLlmSchema>;
/** Prefill fields for a hotel destino (subset of DestinoFormInput). */
export const hotelFieldsSchema = z.object({
  hotelNombre: z.string(),
  hotelCategoria: z.union([z.enum(HOTEL_CATEGORIAS), z.literal("")]),
  hotelUbicacion: z.string(),
  hotelHabitacion: z.string(),
  hotelRegimen: z.string(),
  hotelIncluye: z.string(),
  hotelExcluye: z.string(),
  hotelCondiciones: z.string(),
  /** Nights parsed from stay detail when available; 0 if unknown. */
  hotelNoches: z.number().int().nonnegative(),
  /**
   * Per-adult per-night = total ÷ paxAdultos ÷ nights, ROUND_HALF_UP to integer.
   * 0 when nights unknown (do not invent from stay total alone).
   */
  hotelAdultoNocheArs: z.number().nonnegative(),
  /** Raw total from the image before dividing by adults/nights; 0 if unknown. */
  hotelTotalDetectado: z.number().nonnegative(),
  /** Stay detail text (nights/guests); not a form field — UI may show as hint. */
  hotelEstadiaDetalle: z.string(),
  moneda: z.enum(MONEDAS).optional(),
});

export type HotelExtractFields = z.infer<typeof hotelFieldsSchema>;

/** Prefill fields for trip-level flight segments. */
export const vueloFieldsSchema = z.object({
  aerolinea: z.string(),
  vueloIdaFecha: z.string(),
  vueloIdaHoraSalida: z.string(),
  vueloIdaHoraLlegada: z.string(),
  vueloIdaNumero: z.string(),
  vueloIdaAeropuertoSalida: z.string(),
  vueloIdaAeropuertoLlegada: z.string(),
  vueloVueltaFecha: z.string(),
  vueloVueltaHoraSalida: z.string(),
  vueloVueltaHoraLlegada: z.string(),
  vueloVueltaNumero: z.string(),
  vueloVueltaAeropuertoSalida: z.string(),
  vueloVueltaAeropuertoLlegada: z.string(),
  vueloIdaAdultoArs: z.number().nonnegative().optional(),
  vueloIdaMenorArs: z.number().nonnegative().optional(),
  vueloVueltaAdultoArs: z.number().nonnegative().optional(),
  vueloVueltaMenorArs: z.number().nonnegative().optional(),
  moneda: z.enum(MONEDAS).optional(),
});

export type VueloExtractFields = z.infer<typeof vueloFieldsSchema>;

export const hotelExtractResponseSchema = z.object({
  tipo: z.literal("hotel"),
  fields: hotelFieldsSchema,
  warnings: z.array(z.string()),
  /** Form-field-keyed confidence (hotelNombre, hotelNoches, …). */
  _confidence: fieldConfidenceMapSchema,
});

export const vueloExtractResponseSchema = z.object({
  tipo: z.literal("vuelo"),
  fields: vueloFieldsSchema,
  warnings: z.array(z.string()),
  /** Form-field-keyed confidence (aerolinea, vueloIdaHoraSalida, …). */
  _confidence: fieldConfidenceMapSchema,
});
export const extractQuoteImageResponseSchema = z.discriminatedUnion("tipo", [
  hotelExtractResponseSchema,
  vueloExtractResponseSchema,
]);

export type ExtractQuoteImageResponse = z.infer<
  typeof extractQuoteImageResponseSchema
>;
