import { describe, expect, test } from "vitest";
import {
  extractQuoteImageResponseSchema,
  hotelFieldsSchema,
  hotelLlmSchema,
  vueloFieldsSchema,
  vueloLlmSchema,
} from "@/lib/ai/schemas";

describe("extract response schema contract", () => {
  test("accepts discriminated hotel response shape with _confidence", () => {
    const parsed = extractQuoteImageResponseSchema.safeParse({
      tipo: "hotel",
      fields: {
        hotelNombre: "Test Hotel",
        hotelCategoria: "4★",
        hotelUbicacion: "Iguazú",
        hotelHabitacion: "Doble",
        hotelRegimen: "Desayuno",
        hotelIncluye: "WiFi",
        hotelExcluye: "",
        hotelCondiciones: "",
        hotelAdultoNocheArs: 50_000,
        hotelNoches: 2,
        hotelTotalDetectado: 100_000,
        hotelEstadiaDetalle: "2 noches",
        moneda: "ARS",
      },
      warnings: ["ok"],
      _confidence: {
        hotelNombre: "high",
        hotelAdultoNocheArs: "low",
      },
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data._confidence.hotelNombre).toBe("high");
    expect(parsed.data._confidence.hotelAdultoNocheArs).toBe("low");
  });

  test("defaults missing _confidence to empty object", () => {
    const parsed = extractQuoteImageResponseSchema.safeParse({
      tipo: "vuelo",
      fields: {
        aerolinea: "AR",
        vueloIdaFecha: "2026-08-10",
        vueloIdaHoraSalida: "20:58",
        vueloIdaHoraLlegada: "22:52",
        vueloIdaNumero: "3150",
        vueloIdaAeropuertoSalida: "EZE",
        vueloIdaAeropuertoLlegada: "IGR",
        vueloVueltaFecha: "",
        vueloVueltaHoraSalida: "",
        vueloVueltaHoraLlegada: "",
        vueloVueltaNumero: "",
        vueloVueltaAeropuertoSalida: "",
        vueloVueltaAeropuertoLlegada: "",
      },
      warnings: [],
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data._confidence).toEqual({});
  });

  test("accepts discriminated vuelo response shape", () => {
    const parsed = extractQuoteImageResponseSchema.safeParse({
      tipo: "vuelo",
      fields: {
        aerolinea: "AR",
        vueloIdaFecha: "2026-08-10",
        vueloIdaHoraSalida: "20:58",
        vueloIdaHoraLlegada: "22:52",
        vueloIdaNumero: "3150",
        vueloIdaAeropuertoSalida: "EZE",
        vueloIdaAeropuertoLlegada: "IGR",
        vueloVueltaFecha: "",
        vueloVueltaHoraSalida: "",
        vueloVueltaHoraLlegada: "",
        vueloVueltaNumero: "",
        vueloVueltaAeropuertoSalida: "",
        vueloVueltaAeropuertoLlegada: "",
      },
      warnings: [],
    });
    expect(parsed.success).toBe(true);
  });

  test("rejects unknown tipo", () => {
    expect(
      extractQuoteImageResponseSchema.safeParse({
        tipo: "auto",
        fields: {},
        warnings: [],
      }).success,
    ).toBe(false);
  });

  test("rejects invalid hotelCategoria", () => {
    expect(
      hotelFieldsSchema.safeParse({
        hotelNombre: "x",
        hotelCategoria: "2★",
        hotelUbicacion: "",
        hotelHabitacion: "",
        hotelRegimen: "",
        hotelIncluye: "",
        hotelExcluye: "",
        hotelCondiciones: "",
        hotelNoches: 0,
        hotelAdultoNocheArs: 0,
        hotelTotalDetectado: 0,
        hotelEstadiaDetalle: "",
      }).success,
    ).toBe(false);
  });

  test("LLM schemas require readability flags", () => {
    expect(hotelLlmSchema.safeParse({}).success).toBe(false);
    expect(vueloLlmSchema.safeParse({}).success).toBe(false);
  });

  test("vuelo LLM schema defaults omitted optional strings (Nova-lite)", () => {
    const parsed = vueloLlmSchema.safeParse({
      imageReadable: true,
      isFlightDocument: true,
      airline: "JetSMART",
      idaHoraSalida: "08:30",
      idaAeropuertoSalida: "EZE",
      idaAeropuertoLlegada: "IGR",
      precioIdaAdulto: 95000,
      // currency, dates, warnings, other strings omitted by the model
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.currency).toBe("");
    expect(parsed.data.idaFecha).toBe("");
    expect(parsed.data.warnings).toEqual([]);
    expect(parsed.data.precioIdaMenor).toBeNull();
    expect(parsed.data.airline).toBe("JetSMART");
  });

  test("hotel LLM schema defaults omitted optional strings", () => {
    const parsed = hotelLlmSchema.safeParse({
      imageReadable: true,
      isHotelDocument: true,
      name: "Hotel Cataratas",
      totalPrice: 200_000,
      // currency, ubicacion, warnings, etc. omitted
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.currency).toBe("");
    expect(parsed.data.ubicacion).toBe("");
    expect(parsed.data.warnings).toEqual([]);
    expect(parsed.data.starsRaw).toBe("");
  });

  test("vuelo fields allow optional prices", () => {
    const parsed = vueloFieldsSchema.safeParse({
      aerolinea: "LATAM",
      vueloIdaFecha: "2026-01-01",
      vueloIdaHoraSalida: "",
      vueloIdaHoraLlegada: "",
      vueloIdaNumero: "LA1",
      vueloIdaAeropuertoSalida: "EZE",
      vueloIdaAeropuertoLlegada: "SCL",
      vueloVueltaFecha: "",
      vueloVueltaHoraSalida: "",
      vueloVueltaHoraLlegada: "",
      vueloVueltaNumero: "",
      vueloVueltaAeropuertoSalida: "",
      vueloVueltaAeropuertoLlegada: "",
      vueloIdaAdultoArs: 100,
    });
    expect(parsed.success).toBe(true);
  });
});
