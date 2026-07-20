import { generateObject } from "ai";
import { AI_EXTRACT_MODEL } from "@/lib/ai/constants";
import { AiGatewayConfigError } from "@/lib/ai/errors";
import { mapHotelExtract } from "@/lib/ai/map-hotel";
import {
  type ExtractQuoteImageResponse,
  hotelLlmSchema,
} from "@/lib/ai/schemas";
import { getAiGatewayEnv } from "@/lib/env";
import type { FormMoneda } from "@/lib/validations/cotizacion";

const HOTEL_PROMPT = `Extract structured hotel booking / offer data from this screenshot.

imageReadable rules (strict):
- Set imageReadable=true whenever text/numbers are visible enough to read, even if dense, small, cropped, wide, or dark-themed.
- Dark-mode booking UIs and dense rate tables are READABLE → imageReadable=true.
- Set imageReadable=false ONLY if the image is blank, corrupted, completely black/white with no text, or so blurred/pixelated that NO hotel data can be read at all.

Other rules:
- Set isHotelDocument=false if this is not a hotel booking/offer (e.g. a flight itinerary).
- Use empty strings for unknown text fields; use null for unknown totalPrice.
- Never invent a hotel name, price, or stars that are not visible.
- starsRaw should preserve what you see (e.g. "4 stars", "4*", "4 estrellas").
- includes / excludes / conditions as free text; join list items with newlines.
- stayDetail should summarize nights/guests/check-in if visible.
- warnings: short notes for a travel agent (Spanish OK).`;

export type ExtractHotelParams = {
  imageBytes: Uint8Array;
  mediaType: string;
  paxAdultos: number;
  moneda?: FormMoneda;
};

/**
 * Calls Vercel AI Gateway vision model with Zod structured output, then maps
 * to cotizador hotel form fields.
 */
export async function extractHotelFromImage(
  params: ExtractHotelParams,
): Promise<ExtractQuoteImageResponse> {
  // Touch env early so missing key fails before the network call.
  try {
    getAiGatewayEnv();
  } catch (error) {
    throw new AiGatewayConfigError(
      error instanceof Error ? error.message : "AI Gateway is not configured",
    );
  }

  const { object } = await generateObject({
    model: AI_EXTRACT_MODEL,
    schema: hotelLlmSchema,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: HOTEL_PROMPT },
          {
            type: "file",
            data: params.imageBytes,
            mediaType: params.mediaType,
          },
        ],
      },
    ],
  });

  const mapped = mapHotelExtract({
    llm: object,
    paxAdultos: params.paxAdultos,
    moneda: params.moneda,
  });

  return {
    tipo: "hotel",
    fields: mapped.fields,
    warnings: mapped.warnings,
  };
}
