import {
  ALLOWED_IMAGE_MIME_TYPES,
  isAllowedImageMime,
  MAX_IMAGE_BYTES,
} from "@/lib/ai/constants";
import { InvalidExtractRequestError } from "@/lib/ai/errors";
import { EXTRACT_TIPOS, type ExtractTipo } from "@/lib/ai/schemas";
import { type FormMoneda, MONEDAS } from "@/lib/validations/cotizacion";

export type ParsedExtractRequest = {
  tipo: ExtractTipo;
  imageBytes: Uint8Array;
  mediaType: string;
  paxAdultos?: number;
  moneda?: FormMoneda;
};

function parseTipo(raw: string | null): ExtractTipo {
  const value = raw?.trim().toLowerCase() ?? "";
  if (!(EXTRACT_TIPOS as readonly string[]).includes(value)) {
    throw new InvalidExtractRequestError('tipo must be "hotel" or "vuelo"');
  }
  return value as ExtractTipo;
}

function parsePaxAdultos(
  raw: string | null,
  tipo: ExtractTipo,
): number | undefined {
  if (tipo !== "hotel") {
    if (raw == null || raw.trim() === "") return undefined;
  }
  if (tipo === "hotel" && (raw == null || raw.trim() === "")) {
    throw new InvalidExtractRequestError(
      "paxAdultos is required for hotel extracts",
    );
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new InvalidExtractRequestError("paxAdultos must be an integer >= 1");
  }
  return n;
}

function parseMoneda(raw: string | null): FormMoneda | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const upper = raw.trim().toUpperCase();
  if (!(MONEDAS as readonly string[]).includes(upper)) {
    throw new InvalidExtractRequestError(
      `moneda must be one of: ${MONEDAS.join(", ")}`,
    );
  }
  return upper as FormMoneda;
}

function assertImageSize(bytes: Uint8Array): void {
  if (bytes.byteLength === 0) {
    throw new InvalidExtractRequestError("image is empty");
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new InvalidExtractRequestError(
      `image exceeds ${MAX_IMAGE_BYTES} bytes`,
    );
  }
}

function mediaTypeFromFile(file: File): string {
  const type = file.type.trim().toLowerCase();
  if (type && isAllowedImageMime(type)) return type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  throw new InvalidExtractRequestError(
    `image must be ${ALLOWED_IMAGE_MIME_TYPES.join(", ")}`,
  );
}

async function parseMultipart(request: Request): Promise<ParsedExtractRequest> {
  const form = await request.formData();
  const tipo = parseTipo(
    typeof form.get("tipo") === "string" ? (form.get("tipo") as string) : null,
  );
  const paxRaw =
    typeof form.get("paxAdultos") === "string"
      ? (form.get("paxAdultos") as string)
      : null;
  const monedaRaw =
    typeof form.get("moneda") === "string"
      ? (form.get("moneda") as string)
      : null;

  const imageEntry = form.get("image");
  if (!(imageEntry instanceof File)) {
    throw new InvalidExtractRequestError(
      'multipart field "image" (file) is required',
    );
  }

  const mediaType = mediaTypeFromFile(imageEntry);
  const buffer = new Uint8Array(await imageEntry.arrayBuffer());
  assertImageSize(buffer);

  return {
    tipo,
    imageBytes: buffer,
    mediaType,
    paxAdultos: parsePaxAdultos(paxRaw, tipo),
    moneda: parseMoneda(monedaRaw),
  };
}

type JsonBody = {
  tipo?: unknown;
  imageBase64?: unknown;
  mediaType?: unknown;
  paxAdultos?: unknown;
  moneda?: unknown;
};

async function parseJson(request: Request): Promise<ParsedExtractRequest> {
  let body: JsonBody;
  try {
    body = (await request.json()) as JsonBody;
  } catch {
    throw new InvalidExtractRequestError("Invalid JSON body");
  }

  const tipo = parseTipo(typeof body.tipo === "string" ? body.tipo : null);

  if (typeof body.imageBase64 !== "string" || !body.imageBase64.trim()) {
    throw new InvalidExtractRequestError(
      "imageBase64 is required for JSON requests",
    );
  }

  const mediaTypeRaw =
    typeof body.mediaType === "string"
      ? body.mediaType.trim().toLowerCase()
      : "";
  if (!isAllowedImageMime(mediaTypeRaw)) {
    throw new InvalidExtractRequestError(
      `mediaType must be ${ALLOWED_IMAGE_MIME_TYPES.join(", ")}`,
    );
  }

  let binary: Buffer;
  try {
    // Strip optional data-URL prefix
    const b64 = body.imageBase64.replace(/^data:[^;]+;base64,/, "");
    binary = Buffer.from(b64, "base64");
  } catch {
    throw new InvalidExtractRequestError("imageBase64 is not valid base64");
  }

  const imageBytes = new Uint8Array(binary);
  assertImageSize(imageBytes);

  const paxRaw = body.paxAdultos == null ? null : String(body.paxAdultos);
  const monedaRaw = typeof body.moneda === "string" ? body.moneda : null;

  return {
    tipo,
    imageBytes,
    mediaType: mediaTypeRaw,
    paxAdultos: parsePaxAdultos(paxRaw, tipo),
    moneda: parseMoneda(monedaRaw),
  };
}

/**
 * Parses multipart/form-data or JSON+base64 extract requests.
 */
export async function parseExtractRequest(
  request: Request,
): Promise<ParsedExtractRequest> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    return parseMultipart(request);
  }
  if (contentType.includes("application/json")) {
    return parseJson(request);
  }
  throw new InvalidExtractRequestError(
    "Content-Type must be multipart/form-data or application/json",
  );
}
