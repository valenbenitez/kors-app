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

const HOTEL_PROMPT = `Extract structured hotel booking / offer data from the provided screenshot(s).

You may receive N screenshots of the SAME hotel quote (e.g. rate card + conditions + policies). Merge them into ONE structured object:
- Prefer the clearest / most complete value for name, category, price, and room when sources disagree.
- If one image is blank, corrupted, or unreadable, still extract from the readable ones and add a short warning noting the skipped frame.
- Only set imageReadable=false when EVERY image is unusable (blank/corrupted/completely illegible).

imageReadable rules (strict):
- Set imageReadable=true whenever text/numbers are visible enough to read on at least one image, even if dense, small, cropped, wide, or dark-themed.
- Dark-mode booking UIs and dense rate tables are READABLE → imageReadable=true.
- Set imageReadable=false ONLY if all images are blank, corrupted, completely black/white with no text, or so blurred/pixelated that NO hotel data can be read at all.

Other rules:
- Set isHotelDocument=false if this is not a hotel booking/offer (e.g. a flight itinerary).
- Use empty strings for unknown text fields; use null for unknown totalPrice.
- Never invent a hotel name, price, or stars that are not visible.
- starsRaw should preserve what you see (e.g. "4 stars", "4*", "4 estrellas").
- includes / excludes / conditions as free text; join list items with newlines.
- stayDetail should summarize nights/guests/check-in if visible.
- warnings: short notes for a travel agent (Spanish OK), including partial-failure notes when applicable.`;

export type HotelImageInput = {
  imageBytes: Uint8Array;
  mediaType: string;
};

export type ExtractHotelParams = {
  /** One or more hotel screenshots processed in a single model call. */
  images: HotelImageInput[];
  paxAdultos: number;
  moneda?: FormMoneda;
};

function normalizeImages(images: HotelImageInput[]): HotelImageInput[] {
  if (images.length === 0) {
    throw new Error("extractHotelFromImage requires at least one image");
  }
  return images;
}

/**
 * Calls Vercel AI Gateway vision model with Zod structured output, then maps
 * to cotizador hotel form fields.
 *
 * Partial failure: when multiple images are sent, one unreadable frame must not
 * discard the rest — the prompt asks the model to merge readable frames and
 * surface skipped frames via `warnings`. Domain errors (unreadable / type
 * mismatch / nothing usable) still apply when the whole bundle is unusable.
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

  const images = normalizeImages(params.images);

  const { object } = await generateObject({
    model: AI_EXTRACT_MODEL,
    schema: hotelLlmSchema,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: HOTEL_PROMPT },
          ...images.map((img) => ({
            type: "file" as const,
            data: img.imageBytes,
            mediaType: img.mediaType,
          })),
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
