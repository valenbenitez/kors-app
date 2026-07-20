import { describe, expect, it, vi } from "vitest";
import {
  applyHotelPrefill,
  HOTEL_PREFILL_LABELS,
} from "@/lib/ai/apply-hotel-prefill";
import type { HotelExtractFields } from "@/lib/ai/schemas";
import {
  type CotizacionFormInput,
  defaultCotizacionValues,
  emptyDestino,
} from "@/lib/validations/cotizacion";

function baseFields(
  overrides: Partial<HotelExtractFields> = {},
): HotelExtractFields {
  return {
    hotelNombre: "Hotel Saint George",
    hotelCategoria: "4★",
    hotelUbicacion: "Puerto Iguazú",
    hotelHabitacion: "Twin Master",
    hotelRegimen: "Desayuno",
    hotelIncluye: "WiFi\nPileta",
    hotelExcluye: "Spa",
    hotelCondiciones: "No reembolsable",
    hotelAdultoArs: 213788,
    hotelTotalDetectado: 427575,
    hotelEstadiaDetalle: "3 noches · 2 adultos",
    moneda: "ARS",
    ...overrides,
  };
}

function writeAtPath(
  root: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split(".");
  let cursor: Record<string, unknown> = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (key === undefined) return;
    const next = cursor[key];
    if (next == null || typeof next !== "object") return;
    cursor = next as Record<string, unknown>;
  }
  const last = parts[parts.length - 1];
  if (last === undefined) return;
  cursor[last] = value;
}

function mockSetValue(values: CotizacionFormInput) {
  return vi.fn((path: string, value: unknown) => {
    writeAtPath(values as unknown as Record<string, unknown>, path, value);
  });
}

describe("applyHotelPrefill", () => {
  it("writes hotel metadata and price only to the given destino index", () => {
    const misiones = emptyDestino("Misiones");
    misiones.vueloIdaAdultoArs = 180000;
    const salta = emptyDestino("Salta");
    salta.hotelNombre = "Otro Hotel";
    salta.hotelAdultoArs = 999;
    const values: CotizacionFormInput = {
      ...defaultCotizacionValues,
      aerolinea: "Aerolíneas Argentinas",
      vueloIdaNumero: "AR3150",
      destinos: [misiones, salta],
    };

    const setValue = mockSetValue(values);
    const result = applyHotelPrefill(baseFields(), setValue as never, 0);

    expect(values.aerolinea).toBe("Aerolíneas Argentinas");
    expect(values.vueloIdaNumero).toBe("AR3150");
    expect(values.destinos[0]?.vueloIdaAdultoArs).toBe(180000);
    expect(values.destinos[0]?.hotelNombre).toBe("Hotel Saint George");
    expect(values.destinos[0]?.hotelCategoria).toBe("4★");
    expect(values.destinos[0]?.hotelUbicacion).toBe("Puerto Iguazú");
    expect(values.destinos[0]?.hotelHabitacion).toBe("Twin Master");
    expect(values.destinos[0]?.hotelRegimen).toBe("Desayuno");
    expect(values.destinos[0]?.hotelIncluye).toBe("WiFi\nPileta");
    expect(values.destinos[0]?.hotelExcluye).toBe("Spa");
    expect(values.destinos[0]?.hotelCondiciones).toBe("No reembolsable");
    expect(values.destinos[0]?.hotelAdultoArs).toBe(213788);
    expect(values.destinos[0]?.moneda).toBe("ARS");

    // Other destino untouched
    expect(values.destinos[1]?.hotelNombre).toBe("Otro Hotel");
    expect(values.destinos[1]?.hotelAdultoArs).toBe(999);

    expect(result.filledLabels).toContain(HOTEL_PREFILL_LABELS.hotelNombre);
    expect(result.filledLabels).toContain(HOTEL_PREFILL_LABELS.hotelAdultoArs);
    expect(
      setValue.mock.calls.every(([path]) =>
        String(path).startsWith("destinos.0."),
      ),
    ).toBe(true);
  });

  it("prefills destino index 1 without touching destinos.0", () => {
    const misiones = emptyDestino("Misiones");
    misiones.hotelNombre = "Keep Me";
    misiones.hotelAdultoArs = 50_000;
    const values: CotizacionFormInput = {
      ...defaultCotizacionValues,
      destinos: [misiones, emptyDestino("Salta")],
    };

    const setValue = mockSetValue(values);
    applyHotelPrefill(baseFields(), setValue as never, 1);

    expect(values.destinos[0]?.hotelNombre).toBe("Keep Me");
    expect(values.destinos[0]?.hotelAdultoArs).toBe(50_000);
    expect(values.destinos[1]?.hotelNombre).toBe("Hotel Saint George");
    expect(values.destinos[1]?.hotelAdultoArs).toBe(213788);
  });

  it("skips empty strings and zero hotelAdultoArs", () => {
    const misiones = emptyDestino("Misiones");
    misiones.hotelAdultoArs = 12_000;
    const values: CotizacionFormInput = {
      ...defaultCotizacionValues,
      destinos: [misiones],
    };

    const setValue = mockSetValue(values);
    const result = applyHotelPrefill(
      baseFields({
        hotelNombre: "Solo Nombre",
        hotelCategoria: "",
        hotelUbicacion: "",
        hotelHabitacion: "",
        hotelRegimen: "",
        hotelIncluye: "",
        hotelExcluye: "",
        hotelCondiciones: "",
        hotelAdultoArs: 0,
        hotelTotalDetectado: 0,
        moneda: undefined,
      }),
      setValue as never,
      0,
    );

    expect(values.destinos[0]?.hotelNombre).toBe("Solo Nombre");
    expect(values.destinos[0]?.hotelAdultoArs).toBe(12_000);
    expect(result.filledPaths).toEqual(["destinos.0.hotelNombre"]);
    expect(
      setValue.mock.calls.some(([path]) =>
        String(path).includes("hotelAdultoArs"),
      ),
    ).toBe(false);
  });

  it("returns empty result for invalid destinoIndex", () => {
    const setValue = vi.fn();
    const result = applyHotelPrefill(baseFields(), setValue as never, -1);
    expect(result.filledPaths).toEqual([]);
    expect(setValue).not.toHaveBeenCalled();
  });
});
