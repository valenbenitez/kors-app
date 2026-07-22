import { describe, expect, it } from "vitest";
import {
  cotizacionFormSchema,
  defaultCotizacionValues,
  emptyDestino,
} from "@/lib/validations/cotizacion";

/**
 * Optional vs required decision (Prefill 1/4):
 * - Trip dates `fechaIda` / `fechaVuelta` remain required (existing UX).
 * - Flight segment fields (`vueloIda*` / `vueloVuelta*`) are all optional
 *   with `.default("")` so Firestore docs without them still parse.
 * - Hotel `hotelIncluye` / `hotelExcluye` / `hotelCondiciones` are optional
 *   textareas (default "").
 * - When both segment dates are non-empty, `vueloIdaFecha` ≤ `vueloVueltaFecha`.
 * - Shape: flat trip-level fields (not nested); `aerolinea` stays trip-level.
 */

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    ...defaultCotizacionValues,
    clienteNombre: "Ana Pérez",
    whatsapp: "+5491112345678",
    fechaIda: "2026-08-10",
    fechaVuelta: "2026-08-15",
    destinosSeleccionados: ["Misiones"],
    destinos: [emptyDestino("Misiones")],
    ...overrides,
  };
}

describe("cotizacionFormSchema — flight + hotel prefill fields", () => {
  it("defaults clienteAportaVuelos to false", () => {
    expect(defaultCotizacionValues.clienteAportaVuelos).toBe(false);
    const parsed = cotizacionFormSchema.safeParse(validPayload());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.clienteAportaVuelos).toBe(false);
  });

  it("fills missing clienteAportaVuelos with false (Firestore back-compat)", () => {
    const { clienteAportaVuelos: _omit, ...rest } = validPayload();
    const parsed = cotizacionFormSchema.safeParse(rest);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.clienteAportaVuelos).toBe(false);
  });

  it("accepts clienteAportaVuelos true", () => {
    const parsed = cotizacionFormSchema.safeParse(
      validPayload({ clienteAportaVuelos: true }),
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.clienteAportaVuelos).toBe(true);
  });

  it("accepts a complete form with empty optional flight/hotel fields", () => {
    const parsed = cotizacionFormSchema.safeParse(validPayload());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.vueloIdaNumero).toBe("");
    expect(parsed.data.vueloVueltaAeropuertoSalida).toBe("");
    expect(parsed.data.destinos[0].hotelIncluye).toBe("");
  });

  it("fills missing flight/hotel keys with empty string (Firestore back-compat)", () => {
    const legacy = validPayload();
    // Simulate an older stored form without the new keys.
    const {
      vueloIdaFecha: _a,
      vueloIdaHoraSalida: _b,
      vueloIdaHoraLlegada: _c,
      vueloIdaNumero: _d,
      vueloIdaAeropuertoSalida: _e,
      vueloIdaAeropuertoLlegada: _f,
      vueloVueltaFecha: _g,
      vueloVueltaHoraSalida: _h,
      vueloVueltaHoraLlegada: _i,
      vueloVueltaNumero: _j,
      vueloVueltaAeropuertoSalida: _k,
      vueloVueltaAeropuertoLlegada: _l,
      ...rest
    } = legacy;
    const dest = { ...legacy.destinos[0] } as Record<string, unknown>;
    delete dest.hotelIncluye;
    delete dest.hotelExcluye;
    delete dest.hotelCondiciones;

    const parsed = cotizacionFormSchema.safeParse({
      ...rest,
      destinos: [dest],
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.vueloIdaFecha).toBe("");
    expect(parsed.data.vueloVueltaNumero).toBe("");
    expect(parsed.data.destinos[0].hotelIncluye).toBe("");
    expect(parsed.data.destinos[0].hotelExcluye).toBe("");
    expect(parsed.data.destinos[0].hotelCondiciones).toBe("");
  });

  it("accepts structured optional flight segment fields", () => {
    const parsed = cotizacionFormSchema.safeParse(
      validPayload({
        aerolinea: "JetSMART",
        vueloIdaFecha: "2026-08-10",
        vueloIdaHoraSalida: "20:58",
        vueloIdaHoraLlegada: "22:52",
        vueloIdaNumero: "3150",
        vueloIdaAeropuertoSalida: "EZE",
        vueloIdaAeropuertoLlegada: "IGR",
        vueloVueltaFecha: "2026-08-15",
        vueloVueltaHoraSalida: "08:54",
        vueloVueltaHoraLlegada: "10:54",
        vueloVueltaNumero: "3151",
        vueloVueltaAeropuertoSalida: "IGR",
        vueloVueltaAeropuertoLlegada: "EZE",
      }),
    );
    expect(parsed.success).toBe(true);
  });

  it("rejects trip fechaVuelta before fechaIda", () => {
    const parsed = cotizacionFormSchema.safeParse(
      validPayload({ fechaIda: "2026-08-15", fechaVuelta: "2026-08-10" }),
    );
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues.some((i) => i.path[0] === "fechaVuelta")).toBe(
      true,
    );
  });

  it("rejects flight segment vuelta date before ida when both set", () => {
    const parsed = cotizacionFormSchema.safeParse(
      validPayload({
        vueloIdaFecha: "2026-08-15",
        vueloVueltaFecha: "2026-08-10",
      }),
    );
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(
      parsed.error.issues.some((i) => i.path[0] === "vueloVueltaFecha"),
    ).toBe(true);
  });

  it("allows one flight segment date without the other", () => {
    const onlyIda = cotizacionFormSchema.safeParse(
      validPayload({ vueloIdaFecha: "2026-08-10", vueloVueltaFecha: "" }),
    );
    expect(onlyIda.success).toBe(true);

    const onlyVuelta = cotizacionFormSchema.safeParse(
      validPayload({ vueloIdaFecha: "", vueloVueltaFecha: "2026-08-15" }),
    );
    expect(onlyVuelta.success).toBe(true);
  });

  it("emptyDestino includes hotel text defaults", () => {
    const d = emptyDestino("Misiones");
    expect(d.hotelIncluye).toBe("");
    expect(d.hotelExcluye).toBe("");
    expect(d.hotelCondiciones).toBe("");
  });

  it("defaults incluyeTexto / excluyeTexto to empty string", () => {
    expect(defaultCotizacionValues.incluyeTexto).toBe("");
    expect(defaultCotizacionValues.excluyeTexto).toBe("");
    const parsed = cotizacionFormSchema.safeParse(validPayload());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.incluyeTexto).toBe("");
    expect(parsed.data.excluyeTexto).toBe("");
  });

  it("fills missing incluyeTexto / excluyeTexto (Firestore back-compat)", () => {
    const { incluyeTexto: _a, excluyeTexto: _b, ...rest } = validPayload();
    const parsed = cotizacionFormSchema.safeParse(rest);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.incluyeTexto).toBe("");
    expect(parsed.data.excluyeTexto).toBe("");
  });

  it("accepts seller-edited incluyeTexto / excluyeTexto", () => {
    const parsed = cotizacionFormSchema.safeParse(
      validPayload({
        incluyeTexto: "Vuelos\nHotel",
        excluyeTexto: "Almuerzos",
      }),
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.incluyeTexto).toBe("Vuelos\nHotel");
    expect(parsed.data.excluyeTexto).toBe("Almuerzos");
  });

  it("defaults heroTags / paquetePremium and accepts edits", () => {
    expect(defaultCotizacionValues.heroTags).toEqual([]);
    expect(defaultCotizacionValues.paquetePremium).toBe(false);

    const missing = cotizacionFormSchema.safeParse(
      (() => {
        const { heroTags: _a, paquetePremium: _b, ...rest } = validPayload();
        return rest;
      })(),
    );
    expect(missing.success).toBe(true);
    if (!missing.success) return;
    expect(missing.data.heroTags).toEqual([]);
    expect(missing.data.paquetePremium).toBe(false);

    const edited = cotizacionFormSchema.safeParse(
      validPayload({
        heroTags: [{ emoji: "💧", label: "Cataratas", accent: false }],
        paquetePremium: true,
      }),
    );
    expect(edited.success).toBe(true);
    if (!edited.success) return;
    expect(edited.data.heroTags).toHaveLength(1);
    expect(edited.data.paquetePremium).toBe(true);
  });
});
