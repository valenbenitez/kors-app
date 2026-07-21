import { beforeEach, describe, expect, test, vi } from "vitest";

const generateObject = vi.fn();
const getAiGatewayEnv = vi.fn();
const mapVueloExtract = vi.fn();

vi.mock("ai", () => ({
  generateObject: (...args: unknown[]) => generateObject(...args),
}));

vi.mock("@/lib/env", () => ({
  getAiGatewayEnv: (...args: unknown[]) => getAiGatewayEnv(...args),
}));

vi.mock("@/lib/ai/map-vuelo", () => ({
  mapVueloExtract: (...args: unknown[]) => mapVueloExtract(...args),
}));

import { extractVueloFromImage } from "@/lib/ai/extract-vuelo";

describe("extractVueloFromImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAiGatewayEnv.mockReturnValue({ AI_GATEWAY_API_KEY: "test-key" });
    generateObject.mockResolvedValue({
      object: {
        imageReadable: true,
        isFlightDocument: true,
        airline: "AR",
        idaFecha: "2026-08-10",
        idaHoraSalida: "20:58",
        idaHoraLlegada: "22:52",
        idaNumero: "AR3150",
        idaAeropuertoSalida: "EZE",
        idaAeropuertoLlegada: "IGR",
        vueltaFecha: "",
        vueltaHoraSalida: "",
        vueltaHoraLlegada: "",
        vueltaNumero: "",
        vueltaAeropuertoSalida: "",
        vueltaAeropuertoLlegada: "",
        precioIdaAdulto: null,
        precioIdaMenor: null,
        precioVueltaAdulto: null,
        precioVueltaMenor: null,
        currency: null,
        warnings: [],
      },
    });
    mapVueloExtract.mockReturnValue({
      fields: { aerolinea: "AR", vueloIdaNumero: "AR3150" },
      warnings: [],
    });
  });

  test("sends one file part for a single image (regression)", async () => {
    await extractVueloFromImage({
      images: [{ imageBytes: new Uint8Array([1]), mediaType: "image/png" }],
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

  test("sends multiple file parts in one generateObject call (ida+vuelta)", async () => {
    await extractVueloFromImage({
      images: [
        { imageBytes: new Uint8Array([1]), mediaType: "image/png" },
        { imageBytes: new Uint8Array([2]), mediaType: "image/jpeg" },
      ],
    });

    expect(generateObject).toHaveBeenCalledTimes(1);
    const call = generateObject.mock.calls[0]?.[0] as {
      messages: Array<{ content: Array<{ type: string; mediaType?: string }> }>;
    };
    const files = call.messages[0].content.filter((p) => p.type === "file");
    expect(files).toHaveLength(2);
    expect(files[0].mediaType).toBe("image/png");
    expect(files[1].mediaType).toBe("image/jpeg");
    expect(mapVueloExtract).toHaveBeenCalledTimes(1);
  });
});
