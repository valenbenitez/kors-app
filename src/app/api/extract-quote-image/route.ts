import { NextResponse } from "next/server";
import {
  AiExtractError,
  AiGatewayConfigError,
  InvalidExtractRequestError,
  NothingUsableError,
  TypeMismatchError,
  UnreadableImageError,
} from "@/lib/ai/errors";
import { extractHotelFromImage } from "@/lib/ai/extract-hotel";
import { extractVueloFromImage } from "@/lib/ai/extract-vuelo";
import { parseExtractRequest } from "@/lib/ai/parse-request";
import { extractQuoteImageResponseSchema } from "@/lib/ai/schemas";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const maxDuration = 60;

function spanishError(error: unknown): { status: number; error: string } {
  if (error instanceof InvalidExtractRequestError) {
    return { status: 400, error: mapInvalidRequest(error.message) };
  }
  if (error instanceof UnreadableImageError) {
    return {
      status: 422,
      error: "La imagen no es legible. Probá con otra captura más clara.",
    };
  }
  if (error instanceof TypeMismatchError) {
    return {
      status: 422,
      error:
        "La imagen no coincide con el tipo pedido (hotel o vuelo). Revisá el archivo.",
    };
  }
  if (error instanceof NothingUsableError) {
    return {
      status: 422,
      error:
        "No se pudo extraer información usable de la imagen. Completá los campos a mano.",
    };
  }
  if (error instanceof AiGatewayConfigError) {
    return {
      status: 500,
      error: "Extracción AI no configurada. Falta AI_GATEWAY_API_KEY.",
    };
  }
  if (error instanceof AiExtractError) {
    return {
      status: 422,
      error: "No se pudo extraer la cotización de la imagen.",
    };
  }
  return {
    status: 500,
    error: "No se pudo procesar la imagen. Intentá de nuevo.",
  };
}

function mapInvalidRequest(message: string): string {
  if (message.includes("tipo")) {
    return 'tipo debe ser "hotel" o "vuelo"';
  }
  if (message.includes("paxAdultos is required")) {
    return "paxAdultos es obligatorio para extract de hotel";
  }
  if (message.includes("paxAdultos must")) {
    return "paxAdultos debe ser un entero mayor o igual a 1";
  }
  if (message.includes("vuelo extract allows at most")) {
    return "Demasiadas imágenes de vuelo en un solo envío.";
  }
  if (message.includes("hotel extract allows at most")) {
    return "Demasiadas imágenes de hotel en un solo envío.";
  }
  if (message.includes("vuelo extract requires at least")) {
    return "Subí al menos una imagen de vuelo.";
  }
  if (message.includes("hotel extract requires at least")) {
    return "Subí al menos una imagen de hotel.";
  }
  if (message.includes("image") || message.includes("mediaType")) {
    return "Imagen inválida. Usá JPEG, PNG o WebP.";
  }
  if (message.includes("Content-Type")) {
    return "Content-Type debe ser multipart/form-data o application/json";
  }
  if (message.includes("moneda")) {
    return "Moneda inválida";
  }
  return "Solicitud inválida";
}

/**
 * Authenticated vision extract for hotel / flight screenshots.
 * Prefill only ? does not persist to Firestore.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const parsed = await parseExtractRequest(request);

    const result =
      parsed.tipo === "hotel"
        ? await extractHotelFromImage({
            images: parsed.images.map((img) => ({
              imageBytes: img.bytes,
              mediaType: img.mediaType,
            })),
            paxAdultos: parsed.paxAdultos ?? 1,
            moneda: parsed.moneda,
          })
        : await extractVueloFromImage({
            images: parsed.images.map((img) => ({
              imageBytes: img.bytes,
              mediaType: img.mediaType,
            })),
            moneda: parsed.moneda,
          });

    const validated = extractQuoteImageResponseSchema.parse(result);
    return NextResponse.json(validated);
  } catch (error) {
    const mapped = spanishError(error);
    if (mapped.status >= 500) {
      console.error("extract-quote-image error", error);
    }
    return NextResponse.json(
      { error: mapped.error },
      { status: mapped.status },
    );
  }
}
