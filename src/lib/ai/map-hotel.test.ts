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
  computeHotelAdultoNocheArs,
  mapHotelCategoria,
  mapHotelExtract,
  parseNightsFromStayDetail,
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

describe("parseNightsFromStayDetail", () => {
  test.each([
    ["3 noches · 2 adultos", 3],
    ["1 noche", 1],
    ["Estadía 5 noches", 5],
    ["sin detalle", null],
    ["", null],
  ] as const)("parses %j → %j", (raw, expected) => {
    expect(parseNightsFromStayDetail(raw)).toBe(expected);
  });
});

describe("computeHotelAdultoNocheArs", () => {
  test("divides total by adults and nights with ROUND_HALF_UP to integer", () => {
    // 100_001 / 2 / 3 = 16_666.833… → 16_667
    expect(computeHotelAdultoNocheArs(100_001, 2, 3)).toBe(16_667);
    expect(computeHotelAdultoNocheArs(100_000, 2, 2)).toBe(25_000);
    expect(computeHotelAdultoNocheArs(450_000, 3, 2)).toBe(75_000);
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
  test("maps fixture to form fields and computes hotelAdultoNocheArs", () => {
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
    expect(fields.hotelNoches).toBe(3);
    expect(fields.hotelAdultoNocheArs).toBe(16_667);
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
    expect(fields.hotelNoches).toBe(2);
    expect(fields.hotelAdultoNocheArs).toBe(75_000);
  });

  test("does not invent night rate when nights are not parseable", () => {
    const base = hotelLlmSchema.parse(loadFixture("hotel-llm.json"));
    const llm = { ...base, stayDetail: "check-in 10/08 · 2 adultos" };
    const { fields, warnings } = mapHotelExtract({ llm, paxAdultos: 2 });

    expect(fields.hotelNoches).toBe(0);
    expect(fields.hotelAdultoNocheArs).toBe(0);
    expect(fields.hotelTotalDetectado).toBe(100_001);
    expect(warnings.some((w) => w.includes("sin noches parseables"))).toBe(
      true,
    );
  });

  test("accepts usable extract when imageReadable is false (defensive)", () => {
    const base = hotelLlmSchema.parse(loadFixture("hotel-llm.json"));
    const llm = { ...base, imageReadable: false };
    const { fields, warnings } = mapHotelExtract({ llm, paxAdultos: 2 });

    expect(fields.hotelNombre).toBe("Iguazú Grand Hotel Resort & Casino");
    expect(fields.hotelAdultoNocheArs).toBe(16_667);
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
