import {
  ALLOWED_IMAGE_MIME_TYPES,
  isAllowedImageMime,
  MAX_HOTEL_IMAGES,
  MAX_IMAGE_BYTES,
  MAX_VUELO_IMAGES,
} from "@/lib/ai/constants";
import { InvalidExtractRequestError } from "@/lib/ai/errors";
import { EXTRACT_TIPOS, type ExtractTipo } from "@/lib/ai/schemas";
import { type FormMoneda, MONEDAS } from "@/lib/validations/cotizacion";

export type ParsedImage = {
  bytes: Uint8Array;
  mediaType: string;
};

export type ParsedExtractRequest = {
  tipo: ExtractTipo;
  /** One or more validated images. Hotel: 1..MAX_HOTEL_IMAGES; vuelo: 1..MAX_VUELO_IMAGES. */
  images: ParsedImage[];
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

/**
 * Enforces image-count rules by extract tipo.
 * Partial failures (one unreadable frame in a multi-image bundle) are handled
 * downstream by the model prompt / warnings — this only validates the request shape.
 */
function assertImageCount(tipo: ExtractTipo, count: number): void {
  if (tipo === "vuelo") {
    if (count < 1) {
      throw new InvalidExtractRequestError(
        "vuelo extract requires at least one image",
      );
    }
    if (count > MAX_VUELO_IMAGES) {
      throw new InvalidExtractRequestError(
        `vuelo extract allows at most ${MAX_VUELO_IMAGES} images`,
      );
    }
    return;
  }
  if (count < 1) {
    throw new InvalidExtractRequestError(
      "hotel extract requires at least one image",
    );
  }
  if (count > MAX_HOTEL_IMAGES) {
    throw new InvalidExtractRequestError(
      `hotel extract allows at most ${MAX_HOTEL_IMAGES} images`,
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

/** Collect File entries from repeated `image` and/or `images` multipart fields. */
function collectImageFiles(form: FormData): File[] {
  const files: File[] = [];
  for (const key of ["image", "images"] as const) {
    for (const entry of form.getAll(key)) {
      if (entry instanceof File) {
        files.push(entry);
      }
    }
  }
  return files;
}

async function fileToParsedImage(file: File): Promise<ParsedImage> {
  const mediaType = mediaTypeFromFile(file);
  const bytes = new Uint8Array(await file.arrayBuffer());
  assertImageSize(bytes);
  return { bytes, mediaType };
}

function decodeBase64Image(
  imageBase64: string,
  mediaTypeRaw: string,
): ParsedImage {
  if (!isAllowedImageMime(mediaTypeRaw)) {
    throw new InvalidExtractRequestError(
      `mediaType must be ${ALLOWED_IMAGE_MIME_TYPES.join(", ")}`,
    );
  }

  let binary: Buffer;
  try {
    const b64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
    binary = Buffer.from(b64, "base64");
  } catch {
    throw new InvalidExtractRequestError("imageBase64 is not valid base64");
  }

  const bytes = new Uint8Array(binary);
  assertImageSize(bytes);
  return { bytes, mediaType: mediaTypeRaw };
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

  const files = collectImageFiles(form);
  if (files.length === 0) {
    throw new InvalidExtractRequestError(
      'multipart field "image" (file) is required',
    );
  }

  assertImageCount(tipo, files.length);
  const images = await Promise.all(files.map(fileToParsedImage));

  return {
    tipo,
    images,
    paxAdultos: parsePaxAdultos(paxRaw, tipo),
    moneda: parseMoneda(monedaRaw),
  };
}

type JsonImageItem = {
  imageBase64?: unknown;
  mediaType?: unknown;
};

type JsonBody = {
  tipo?: unknown;
  imageBase64?: unknown;
  mediaType?: unknown;
  images?: unknown;
  paxAdultos?: unknown;
  moneda?: unknown;
};

function parseJsonImages(body: JsonBody): ParsedImage[] {
  if (Array.isArray(body.images) && body.images.length > 0) {
    return body.images.map((item, index) => {
      const row = item as JsonImageItem;
      if (typeof row.imageBase64 !== "string" || !row.imageBase64.trim()) {
        throw new InvalidExtractRequestError(
          `images[${index}].imageBase64 is required`,
        );
      }
      const mediaTypeRaw =
        typeof row.mediaType === "string"
          ? row.mediaType.trim().toLowerCase()
          : "";
      return decodeBase64Image(row.imageBase64, mediaTypeRaw);
    });
  }

  // Back-compat: single imageBase64 + mediaType
  if (typeof body.imageBase64 !== "string" || !body.imageBase64.trim()) {
    throw new InvalidExtractRequestError(
      "imageBase64 is required for JSON requests",
    );
  }
  const mediaTypeRaw =
    typeof body.mediaType === "string"
      ? body.mediaType.trim().toLowerCase()
      : "";
  return [decodeBase64Image(body.imageBase64, mediaTypeRaw)];
}

async function parseJson(request: Request): Promise<ParsedExtractRequest> {
  let body: JsonBody;
  try {
    body = (await request.json()) as JsonBody;
  } catch {
    throw new InvalidExtractRequestError("Invalid JSON body");
  }

  const tipo = parseTipo(typeof body.tipo === "string" ? body.tipo : null);
  const images = parseJsonImages(body);
  assertImageCount(tipo, images.length);

  const paxRaw = body.paxAdultos == null ? null : String(body.paxAdultos);
  const monedaRaw = typeof body.moneda === "string" ? body.moneda : null;

  return {
    tipo,
    images,
    paxAdultos: parsePaxAdultos(paxRaw, tipo),
    moneda: parseMoneda(monedaRaw),
  };
}

/**
 * Parses multipart/form-data or JSON+base64 extract requests.
 * Multipart: repeated `image` and/or `images` file fields.
 * JSON: `images: [{ imageBase64, mediaType }]` or single `imageBase64` (back-compat).
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
