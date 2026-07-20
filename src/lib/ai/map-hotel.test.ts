import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  NothingUsableError,
  TypeMismatchError,
  UnreadableImageError,
} from "@/lib/ai/errors";
import {
  computeHotelAdultoArs,
  mapHotelCategoria,
  mapHotelExtract,
} from "@/lib/ai/map-hotel";
import {
  extractQuoteImageResponseSchema,
  hotelExtractResponseSchema,
  hotelLlmSchema,
} from "@/lib/ai/schemas";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(fixturesDir, name), "utf8"));
}

describe("computeHotelAdultoArs", () => {
  test("divides total by adults with ROUND_HALF_UP to integer pesos", () => {
    // 100_001 / 2 = 50_000.5 → 50_001
    expect(computeHotelAdultoArs(100_001, 2)).toBe(50_001);
    expect(computeHotelAdultoArs(100_000, 2)).toBe(50_000);
    expect(computeHotelAdultoArs(99_999, 2)).toBe(50_000);
    expect(computeHotelAdultoArs(450_000, 3)).toBe(150_000);
  });
});

describe("mapHotelCategoria", () => {
  test.each([
    ["4★", "4★"],
    ["4 stars", "4★"],
    ["4*", "4★"],
    ["4 estrellas", "4★"],
    ["5 Stars", "5★"],
    ["3 estrellas", "3★"],
    ["", ""],
    ["luxury", ""],
    ["2 stars", ""],
  ] as const)("maps %j → %j", (raw, expected) => {
    expect(mapHotelCategoria(raw)).toBe(expected);
  });
});

describe("mapHotelExtract", () => {
  test("maps fixture to form fields and computes hotelAdultoArs", () => {
    const llm = hotelLlmSchema.parse(loadFixture("hotel-llm.json"));
    const { fields, warnings } = mapHotelExtract({
      llm,
      paxAdultos: 2,
    });

    expect(fields.hotelNombre).toBe("Iguazú Grand Hotel Resort & Casino");
    expect(fields.hotelCategoria).toBe("4★");
    expect(fields.hotelUbicacion).toBe("Puerto Iguazú, Misiones");
    expect(fields.hotelHabitacion).toBe("Habitación Superior Doble");
    expect(fields.hotelRegimen).toBe("Desayuno buffet");
    expect(fields.hotelIncluye).toContain("WiFi");
    expect(fields.hotelExcluye).toContain("Spa");
    expect(fields.hotelCondiciones).toContain("No reembolsable");
    expect(fields.hotelTotalDetectado).toBe(100_001);
    expect(fields.hotelAdultoArs).toBe(50_001);
    expect(fields.hotelEstadiaDetalle).toContain("3 noches");
    expect(fields.moneda).toBe("ARS");
    expect(warnings.some((w) => w.includes("HALF_UP"))).toBe(true);

    const response = hotelExtractResponseSchema.parse({
      tipo: "hotel",
      fields,
      warnings,
    });
    expect(response.tipo).toBe("hotel");
    expect(extractQuoteImageResponseSchema.safeParse(response).success).toBe(
      true,
    );
  });

  test("maps Spanish estrellas categoría from fixture", () => {
    const llm = hotelLlmSchema.parse(
      loadFixture("hotel-categoria-variantes.json"),
    );
    const { fields } = mapHotelExtract({ llm, paxAdultos: 3 });
    expect(fields.hotelCategoria).toBe("4★");
    expect(fields.hotelAdultoArs).toBe(150_000);
  });

  test("accepts usable extract when imageReadable is false (defensive)", () => {
    const base = hotelLlmSchema.parse(loadFixture("hotel-llm.json"));
    const llm = { ...base, imageReadable: false };
    const { fields, warnings } = mapHotelExtract({ llm, paxAdultos: 2 });

    expect(fields.hotelNombre).toBe("Iguazú Grand Hotel Resort & Casino");
    expect(fields.hotelAdultoArs).toBe(50_001);
    expect(warnings.some((w) => w.includes("poco legible"))).toBe(true);
  });

  test("throws UnreadableImageError when imageReadable is false and empty", () => {
    const llm = hotelLlmSchema.parse({
      imageReadable: false,
      isHotelDocument: true,
      name: "",
      starsRaw: "",
      totalPrice: null,
      currency: "",
      ubicacion: "",
      stayDetail: "",
      roomType: "",
      regimen: "",
      includes: "",
      excludes: "",
      conditions: "",
      warnings: [],
    });
    expect(() => mapHotelExtract({ llm, paxAdultos: 1 })).toThrow(
      UnreadableImageError,
    );
  });

  test("throws TypeMismatchError when not a hotel document", () => {
    const base = hotelLlmSchema.parse(loadFixture("hotel-llm.json"));
    const llm = { ...base, isHotelDocument: false };
    expect(() => mapHotelExtract({ llm, paxAdultos: 2 })).toThrow(
      TypeMismatchError,
    );
  });

  test("throws NothingUsableError when all fields empty", () => {
    const llm = hotelLlmSchema.parse({
      imageReadable: true,
      isHotelDocument: true,
      name: "",
      starsRaw: "",
      totalPrice: null,
      currency: "",
      ubicacion: "",
      stayDetail: "",
      roomType: "",
      regimen: "",
      includes: "",
      excludes: "",
      conditions: "",
      warnings: [],
    });
    expect(() => mapHotelExtract({ llm, paxAdultos: 1 })).toThrow(
      NothingUsableError,
    );
  });
});
