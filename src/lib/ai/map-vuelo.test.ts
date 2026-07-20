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
  mapVueloExtract,
  normalizeFlightDate,
  normalizeFlightTime,
  normalizeIata,
} from "@/lib/ai/map-vuelo";
import {
  extractQuoteImageResponseSchema,
  vueloExtractResponseSchema,
  vueloLlmSchema,
} from "@/lib/ai/schemas";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(fixturesDir, name), "utf8"));
}

describe("normalizeIata", () => {
  test.each([
    ["eze", "EZE"],
    ["IGR", "IGR"],
    ["Buenos Aires (EZE)", "EZE"],
    ["", ""],
    ["Buenos Aires", ""],
    ["xyz1", ""],
  ] as const)("maps %j → %j", (raw, expected) => {
    expect(normalizeIata(raw)).toBe(expected);
  });
});

describe("normalizeFlightDate", () => {
  test("keeps YYYY-MM-DD and drops invented / non-ISO dates", () => {
    expect(normalizeFlightDate("2026-08-10")).toBe("2026-08-10");
    expect(normalizeFlightDate("10/08/2026")).toBe("");
    expect(normalizeFlightDate("")).toBe("");
  });
});

describe("normalizeFlightTime", () => {
  test("pads hours to HH:mm", () => {
    expect(normalizeFlightTime("20:58")).toBe("20:58");
    expect(normalizeFlightTime("8:05")).toBe("08:05");
    expect(normalizeFlightTime("8:5")).toBe("");
    expect(normalizeFlightTime("")).toBe("");
  });
});

describe("mapVueloExtract", () => {
  test("maps fixture to vueloIda* / vueloVuelta* form fields", () => {
    const llm = vueloLlmSchema.parse(loadFixture("vuelo-llm.json"));
    const { fields, warnings } = mapVueloExtract({ llm });

    expect(fields.aerolinea).toBe("Aerolíneas Argentinas");
    expect(fields.vueloIdaFecha).toBe("2026-08-10");
    expect(fields.vueloIdaHoraSalida).toBe("20:58");
    expect(fields.vueloIdaHoraLlegada).toBe("22:52");
    expect(fields.vueloIdaNumero).toBe("AR3150");
    expect(fields.vueloIdaAeropuertoSalida).toBe("EZE");
    expect(fields.vueloIdaAeropuertoLlegada).toBe("IGR");
    expect(fields.vueloVueltaFecha).toBe("2026-08-15");
    expect(fields.vueloVueltaAeropuertoSalida).toBe("IGR");
    expect(fields.vueloVueltaAeropuertoLlegada).toBe("EZE");
    expect(fields.vueloIdaAdultoArs).toBe(180_000);
    expect(fields.vueloVueltaAdultoArs).toBe(175_000);
    expect(fields.vueloIdaMenorArs).toBeUndefined();
    expect(fields.moneda).toBe("ARS");
    expect(warnings).toEqual([]);

    const response = vueloExtractResponseSchema.parse({
      tipo: "vuelo",
      fields,
      warnings,
    });
    expect(extractQuoteImageResponseSchema.safeParse(response).success).toBe(
      true,
    );
  });

  test("does not invent dates or IATA from partial fixture", () => {
    const llm = vueloLlmSchema.parse(loadFixture("vuelo-partial.json"));
    const { fields, warnings } = mapVueloExtract({ llm });

    expect(fields.aerolinea).toBe("LATAM");
    expect(fields.vueloIdaNumero).toBe("LA4001");
    expect(fields.vueloIdaFecha).toBe("");
    expect(fields.vueloIdaAeropuertoSalida).toBe("");
    expect(fields.vueloIdaAeropuertoLlegada).toBe("");
    expect(warnings.some((w) => w.includes("no se inventó"))).toBe(true);
    expect(warnings.some((w) => w.includes("IATA"))).toBe(true);
  });

  test("accepts usable extract when imageReadable is false (defensive)", () => {
    const base = vueloLlmSchema.parse(loadFixture("vuelo-llm.json"));
    const llm = { ...base, imageReadable: false };
    const { fields, warnings } = mapVueloExtract({ llm });

    expect(fields.aerolinea).toBe("Aerolíneas Argentinas");
    expect(fields.vueloIdaAeropuertoSalida).toBe("EZE");
    expect(fields.vueloIdaAeropuertoLlegada).toBe("IGR");
    expect(warnings.some((w) => w.includes("poco legible"))).toBe(true);
  });

  test("throws UnreadableImageError when imageReadable is false and empty", () => {
    const llm = vueloLlmSchema.parse({
      imageReadable: false,
      isFlightDocument: true,
      airline: "",
      idaFecha: "",
      idaHoraSalida: "",
      idaHoraLlegada: "",
      idaNumero: "",
      idaAeropuertoSalida: "",
      idaAeropuertoLlegada: "",
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
      currency: "",
      warnings: [],
    });
    expect(() => mapVueloExtract({ llm })).toThrow(UnreadableImageError);
  });

  test("throws TypeMismatchError when not a flight document", () => {
    const base = vueloLlmSchema.parse(loadFixture("vuelo-llm.json"));
    const llm = { ...base, isFlightDocument: false };
    expect(() => mapVueloExtract({ llm })).toThrow(TypeMismatchError);
  });

  test("throws NothingUsableError when empty", () => {
    const llm = vueloLlmSchema.parse({
      imageReadable: true,
      isFlightDocument: true,
      airline: "",
      idaFecha: "",
      idaHoraSalida: "",
      idaHoraLlegada: "",
      idaNumero: "",
      idaAeropuertoSalida: "",
      idaAeropuertoLlegada: "",
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
      currency: "",
      warnings: [],
    });
    expect(() => mapVueloExtract({ llm })).toThrow(NothingUsableError);
  });
});
