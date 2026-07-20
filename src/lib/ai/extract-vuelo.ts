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

const VUELO_PROMPT = `Extract structured flight itinerary data from this screenshot (Matrix, ITA Matrix, airline, OTA, Booking.com flights, etc.).

imageReadable rules (strict):
- Set imageReadable=true whenever text/numbers are visible enough to read, even if dense, small, cropped, wide, or dark-themed.
- Dark-mode UIs (e.g. Matrix / ITA fare construction with dark background) are READABLE → imageReadable=true.
- Dense fare-construction grids, multi-segment tables, and low-contrast-but-legible screenshots are still readable.
- Set imageReadable=false ONLY if the image is blank, corrupted, completely black/white with no text, or so blurred/pixelated that NO flight data can be read at all.

Other rules:
- Set isFlightDocument=false if this is not a flight itinerary (e.g. a hotel booking).
- Dates MUST be YYYY-MM-DD when visible; use empty string if unsure — NEVER invent dates.
- Times as HH:mm when visible.
- Airports: prefer IATA codes (EZE, IGR). If only a city name is visible, put the name and leave mapping to the server.
- Prices optional — use null when not visible.
- Never invent flight numbers, airports, or prices.
- warnings: short notes for a travel agent (Spanish OK).`;

export type ExtractVueloParams = {
  imageBytes: Uint8Array;
  mediaType: string;
  moneda?: FormMoneda;
};

/**
 * Calls Vercel AI Gateway vision model with Zod structured output, then maps
 * to cotizador flight form fields.
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

  const { object } = await generateObject({
    model: AI_EXTRACT_MODEL,
    schema: vueloLlmSchema,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: VUELO_PROMPT },
          {
            type: "file",
            data: params.imageBytes,
            mediaType: params.mediaType,
          },
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
  };
}
