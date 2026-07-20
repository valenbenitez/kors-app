import { beforeEach, describe, expect, test, vi } from "vitest";

const getSession = vi.fn();
const extractHotelFromImage = vi.fn();
const extractVueloFromImage = vi.fn();
const parseExtractRequest = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getSession: (...args: unknown[]) => getSession(...args),
}));

vi.mock("@/lib/ai/extract-hotel", () => ({
  extractHotelFromImage: (...args: unknown[]) => extractHotelFromImage(...args),
}));

vi.mock("@/lib/ai/extract-vuelo", () => ({
  extractVueloFromImage: (...args: unknown[]) => extractVueloFromImage(...args),
}));

vi.mock("@/lib/ai/parse-request", () => ({
  parseExtractRequest: (...args: unknown[]) => parseExtractRequest(...args),
}));

import { POST } from "@/app/api/extract-quote-image/route";
import {
  InvalidExtractRequestError,
  NothingUsableError,
  TypeMismatchError,
  UnreadableImageError,
} from "@/lib/ai/errors";

function bareRequest(): Request {
  return new Request("http://localhost/api/extract-quote-image", {
    method: "POST",
  });
}

const hotelResult = {
  tipo: "hotel" as const,
  fields: {
    hotelNombre: "Hotel Test",
    hotelCategoria: "4★" as const,
    hotelUbicacion: "Iguazú",
    hotelHabitacion: "Doble",
    hotelRegimen: "",
    hotelIncluye: "WiFi",
    hotelExcluye: "",
    hotelCondiciones: "",
    hotelAdultoArs: 50_000,
    hotelTotalDetectado: 100_000,
    hotelEstadiaDetalle: "2 noches",
    moneda: "ARS" as const,
  },
  warnings: [],
};

describe("POST /api/extract-quote-image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns 401 when there is no session", async () => {
    getSession.mockResolvedValue(null);

    const response = await POST(bareRequest());
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autorizado");
    expect(parseExtractRequest).not.toHaveBeenCalled();
    expect(extractHotelFromImage).not.toHaveBeenCalled();
  });

  test("returns 400 for invalid request", async () => {
    getSession.mockResolvedValue({ email: "a@kors.com", sub: "uid-1" });
    parseExtractRequest.mockRejectedValue(
      new InvalidExtractRequestError('tipo must be "hotel" or "vuelo"'),
    );

    const response = await POST(bareRequest());
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("hotel");
    expect(extractHotelFromImage).not.toHaveBeenCalled();
  });

  test("returns hotel happy-path shape", async () => {
    getSession.mockResolvedValue({ email: "a@kors.com", sub: "uid-1" });
    parseExtractRequest.mockResolvedValue({
      tipo: "hotel",
      imageBytes: new Uint8Array([1, 2, 3]),
      mediaType: "image/jpeg",
      paxAdultos: 2,
    });
    extractHotelFromImage.mockResolvedValue(hotelResult);

    const response = await POST(bareRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tipo).toBe("hotel");
    expect(data.fields.hotelAdultoArs).toBe(50_000);
    expect(data.fields.hotelCategoria).toBe("4★");
    expect(Array.isArray(data.warnings)).toBe(true);
    expect(extractVueloFromImage).not.toHaveBeenCalled();
  });

  test("returns 422 when image is unreadable", async () => {
    getSession.mockResolvedValue({ email: "a@kors.com", sub: "uid-1" });
    parseExtractRequest.mockResolvedValue({
      tipo: "vuelo",
      imageBytes: new Uint8Array([1]),
      mediaType: "image/png",
    });
    extractVueloFromImage.mockRejectedValue(new UnreadableImageError());

    const response = await POST(bareRequest());
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toBe(
      "La imagen no es legible. Probá con otra captura más clara.",
    );
  });

  test("returns 422 on type mismatch", async () => {
    getSession.mockResolvedValue({ email: "a@kors.com", sub: "uid-1" });
    parseExtractRequest.mockResolvedValue({
      tipo: "hotel",
      imageBytes: new Uint8Array([1]),
      mediaType: "image/png",
      paxAdultos: 1,
    });
    extractHotelFromImage.mockRejectedValue(new TypeMismatchError());

    const response = await POST(bareRequest());
    expect(response.status).toBe(422);
  });

  test("returns 422 when nothing usable", async () => {
    getSession.mockResolvedValue({ email: "a@kors.com", sub: "uid-1" });
    parseExtractRequest.mockResolvedValue({
      tipo: "hotel",
      imageBytes: new Uint8Array([1]),
      mediaType: "image/png",
      paxAdultos: 1,
    });
    extractHotelFromImage.mockRejectedValue(new NothingUsableError());

    const response = await POST(bareRequest());
    expect(response.status).toBe(422);
  });
});
