import { generateObject } from "ai";
import { AI_EXTRACT_MODEL } from "@/lib/ai/constants";
import { AiGatewayConfigError } from "@/lib/ai/errors";
import { mapVueloExtract } from "@/lib/ai/map-vuelo";
import {
  type ExtractQuoteImageResponse,
  vueloLlmSchema,
} from "@/lib/ai/schemas";
import { getAiGatewayEnv } from "@/lib/env";
import type { FormMoneda } from "@/lib/validations/cotizacion";

function buildVueloPrompt(currentYear = new Date().getFullYear()): string {
  return `Extract structured flight itinerary data from the provided screenshot(s) (Matrix, ITA Matrix, airline, OTA, Booking.com flights, etc.).

You may receive N screenshots of the SAME trip (e.g. outbound and return as separate captures). Merge them into ONE structured object:
- Fill ida (outbound) fields from the outbound capture and vuelta (return) fields from the return capture.
- Prefer the clearest / most complete value when sources disagree on shared fields (airline, airports).
- If one image is blank, corrupted, or unreadable, still extract from the readable ones and add a short warning noting the skipped frame.
- Only set imageReadable=false when EVERY image is unusable (blank/corrupted/completely illegible).

imageReadable rules (strict):
- Set imageReadable=true whenever text/numbers are visible enough to read on at least one image, even if dense, small, cropped, wide, or dark-themed.
- Dark-mode UIs (e.g. Matrix / ITA fare construction with dark background) are READABLE → imageReadable=true.
- Dense fare-construction grids, multi-segment tables, and low-contrast-but-legible screenshots are still readable.
- Set imageReadable=false ONLY if all images are blank, corrupted, completely black/white with no text, or so blurred/pixelated that NO flight data can be read at all.

Other rules:
- Set isFlightDocument=false if this is not a flight itinerary (e.g. a hotel booking).
- Dates MUST be YYYY-MM-DD when month/day are visible; use empty string if month/day are unsure — NEVER invent month/day.
- When month/day are visible but the year is missing or ambiguous (e.g. "Aug 5", "05/08"), assume the current calendar year (${currentYear}). Only use another year if that year is explicitly visible on the image.
- Times as HH:mm when visible.
- Airports: prefer IATA codes (EZE, IGR). If only a city name is visible, put the name and leave mapping to the server.
- Prices optional — use null when not visible.
- Never invent flight numbers, airports, or prices.
- warnings: short notes for a travel agent (Spanish OK), including partial-failure notes when applicable.
- _confidence: for EVERY non-empty field you extract, set high|medium|low under _confidence using the same key (airline, idaFecha, idaHoraSalida, idaHoraLlegada, idaNumero, idaAeropuertoSalida, idaAeropuertoLlegada, vuelta*, precioIdaAdulto, precioIdaMenor, precioVueltaAdulto, precioVueltaMenor, currency).
  - high = clearly legible and unambiguous.
  - medium = readable but blurry, cropped, or slightly ambiguous.
  - low = guessed from partial/unclear text — seller should review.
  Omit keys for empty/null fields.`;
}

export type VueloImageInput = {
  imageBytes: Uint8Array;
  mediaType: string;
};

export type ExtractVueloParams = {
  /** One or more flight screenshots processed in a single model call. */
  images: VueloImageInput[];
  moneda?: FormMoneda;
};

function normalizeImages(images: VueloImageInput[]): VueloImageInput[] {
  if (images.length === 0) {
    throw new Error("extractVueloFromImage requires at least one image");
  }
  return images;
}

/**
 * Calls Vercel AI Gateway vision model with Zod structured output, then maps
 * to cotizador flight form fields.
 *
 * Partial failure: when multiple images are sent (e.g. ida + vuelta), one
 * unreadable frame must not discard the rest — the prompt asks the model to
 * merge readable frames and surface skipped frames via `warnings`. Domain
 * errors still apply when the whole bundle is unusable.
 */
export async function extractVueloFromImage(
  params: ExtractVueloParams,
): Promise<ExtractQuoteImageResponse> {
  try {
    getAiGatewayEnv();
  } catch (error) {
    throw new AiGatewayConfigError(
      error instanceof Error ? error.message : "AI Gateway is not configured",
    );
  }

  const images = normalizeImages(params.images);

  const { object } = await generateObject({
    model: AI_EXTRACT_MODEL,
    schema: vueloLlmSchema,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: buildVueloPrompt() },
          ...images.map((img) => ({
            type: "file" as const,
            data: img.imageBytes,
            mediaType: img.mediaType,
          })),
        ],
      },
    ],
  });

  const mapped = mapVueloExtract({
    llm: object,
    moneda: params.moneda,
  });

  return {
    tipo: "vuelo",
    fields: mapped.fields,
    warnings: mapped.warnings,
    _confidence: mapped._confidence,
  };
}
