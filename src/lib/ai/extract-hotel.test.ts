import { beforeEach, describe, expect, test, vi } from "vitest";

const generateObject = vi.fn();
const getAiGatewayEnv = vi.fn();
const mapHotelExtract = vi.fn();

vi.mock("ai", () => ({
  generateObject: (...args: unknown[]) => generateObject(...args),
}));

vi.mock("@/lib/env", () => ({
  getAiGatewayEnv: (...args: unknown[]) => getAiGatewayEnv(...args),
}));

vi.mock("@/lib/ai/map-hotel", () => ({
  mapHotelExtract: (...args: unknown[]) => mapHotelExtract(...args),
}));

import { extractHotelFromImage } from "@/lib/ai/extract-hotel";

describe("extractHotelFromImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAiGatewayEnv.mockReturnValue({ AI_GATEWAY_API_KEY: "test-key" });
    generateObject.mockResolvedValue({
      object: {
        imageReadable: true,
        isHotelDocument: true,
        name: "Hotel Test",
        starsRaw: "4",
        totalPrice: 100,
        currency: "ARS",
        ubicacion: "",
        stayDetail: "",
        roomType: "",
        regimen: "",
        includes: "",
        excludes: "",
        conditions: "",
        warnings: [],
      },
    });
    mapHotelExtract.mockReturnValue({
      fields: { hotelNombre: "Hotel Test" },
      warnings: [],
    });
  });

  test("sends one file part for a single image (regression)", async () => {
    await extractHotelFromImage({
      images: [{ imageBytes: new Uint8Array([1]), mediaType: "image/png" }],
      paxAdultos: 2,
    });

    expect(generateObject).toHaveBeenCalledTimes(1);
    const call = generateObject.mock.calls[0]?.[0] as {
      messages: Array<{ content: unknown[] }>;
    };
    const content = call.messages[0].content;
    expect(content[0]).toMatchObject({ type: "text" });
    expect(
      content.filter((p) => (p as { type: string }).type === "file"),
    ).toHaveLength(1);
  });

  test("sends multiple file parts in one generateObject call", async () => {
    await extractHotelFromImage({
      images: [
        { imageBytes: new Uint8Array([1]), mediaType: "image/png" },
        { imageBytes: new Uint8Array([2]), mediaType: "image/jpeg" },
      ],
      paxAdultos: 2,
    });

    expect(generateObject).toHaveBeenCalledTimes(1);
    const call = generateObject.mock.calls[0]?.[0] as {
      messages: Array<{ content: Array<{ type: string; mediaType?: string }> }>;
    };
    const files = call.messages[0].content.filter((p) => p.type === "file");
    expect(files).toHaveLength(2);
    expect(files[0].mediaType).toBe("image/png");
    expect(files[1].mediaType).toBe("image/jpeg");
    expect(mapHotelExtract).toHaveBeenCalledTimes(1);
  });
});
