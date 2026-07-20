import { describe, expect, it, vi } from "vitest";
import {
  applyVueloPrefill,
  VUELO_PREFILL_LABELS,
} from "@/lib/ai/apply-vuelo-prefill";
import type { VueloExtractFields } from "@/lib/ai/schemas";
import {
  type CotizacionFormInput,
  defaultCotizacionValues,
  emptyDestino,
} from "@/lib/validations/cotizacion";

function baseFields(
  overrides: Partial<VueloExtractFields> = {},
): VueloExtractFields {
  return {
    aerolinea: "Aerolíneas Argentinas",
    vueloIdaFecha: "2026-08-10",
    vueloIdaHoraSalida: "20:58",
    vueloIdaHoraLlegada: "22:52",
    vueloIdaNumero: "AR3150",
    vueloIdaAeropuertoSalida: "EZE",
    vueloIdaAeropuertoLlegada: "IGR",
    vueloVueltaFecha: "2026-08-15",
    vueloVueltaHoraSalida: "18:10",
    vueloVueltaHoraLlegada: "20:05",
    vueloVueltaNumero: "AR3151",
    vueloVueltaAeropuertoSalida: "IGR",
    vueloVueltaAeropuertoLlegada: "EZE",
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

describe("applyVueloPrefill", () => {
  it("sets trip-level flight fields and fechaIda/fechaVuelta without touching client", () => {
    const values: CotizacionFormInput = {
      ...defaultCotizacionValues,
      clienteNombre: "Ana",
      whatsapp: "+54 9 11 1111",
    };
    const setValue = mockSetValue(values);
    const getValues = vi.fn((name?: string) => {
      if (!name) return values;
      const parts = name.split(".");
      let cursor: unknown = values;
      for (const p of parts) {
        cursor = (cursor as Record<string, unknown>)[p];
      }
      return cursor;
    });

    const result = applyVueloPrefill(
      baseFields(),
      setValue as never,
      getValues as never,
    );

    expect(values.clienteNombre).toBe("Ana");
    expect(values.whatsapp).toBe("+54 9 11 1111");
    expect(values.aerolinea).toBe("Aerolíneas Argentinas");
    expect(values.fechaIda).toBe("2026-08-10");
    expect(values.fechaVuelta).toBe("2026-08-15");
    expect(values.vueloIdaNumero).toBe("AR3150");
    expect(values.vueloIdaAeropuertoSalida).toBe("EZE");
    expect(result.filledLabels).toContain(VUELO_PREFILL_LABELS.aerolinea);
    expect(result.filledLabels).toContain(VUELO_PREFILL_LABELS.fechaIda);
    expect(result.skippedPricesWarning).toBeNull();
  });

  it("writes prices to destinos.0 when a destino exists", () => {
    const values: CotizacionFormInput = {
      ...defaultCotizacionValues,
      destinos: [emptyDestino("Misiones")],
    };
    const setValue = mockSetValue(values);
    const getValues = vi.fn((name?: string) => {
      if (!name) return values;
      if (name === "destinos") return values.destinos;
      return undefined;
    });

    applyVueloPrefill(
      baseFields({
        vueloIdaAdultoArs: 180000,
        vueloVueltaAdultoArs: 175000,
        moneda: "ARS",
      }),
      setValue as never,
      getValues as never,
    );

    expect(values.destinos[0]?.vueloIdaAdultoArs).toBe(180000);
    expect(values.destinos[0]?.vueloVueltaAdultoArs).toBe(175000);
    expect(values.destinos[0]?.moneda).toBe("ARS");
  });

  it("skips prices and warns when no destino is selected", () => {
    const values: CotizacionFormInput = {
      ...defaultCotizacionValues,
      destinosSeleccionados: [],
      destinos: [],
    };
    const setValue = vi.fn();
    const getValues = vi.fn((name?: string) => {
      if (name === "destinos") return values.destinos;
      return values;
    });

    const result = applyVueloPrefill(
      baseFields({ vueloIdaAdultoArs: 100 }),
      setValue as never,
      getValues as never,
    );

    expect(result.skippedPricesWarning).toMatch(/no hay destino seleccionado/i);
    expect(
      setValue.mock.calls.some(([path]) =>
        String(path).includes("vueloIdaAdultoArs"),
      ),
    ).toBe(false);
  });

  it("does not set empty string fields", () => {
    const setValue = vi.fn();
    const getValues = vi.fn(() => defaultCotizacionValues.destinos);

    applyVueloPrefill(
      baseFields({
        aerolinea: "",
        vueloIdaNumero: "AR1",
        vueloIdaFecha: "",
        vueloVueltaFecha: "",
        vueloIdaHoraSalida: "",
        vueloIdaHoraLlegada: "",
        vueloIdaAeropuertoSalida: "",
        vueloIdaAeropuertoLlegada: "",
        vueloVueltaHoraSalida: "",
        vueloVueltaHoraLlegada: "",
        vueloVueltaNumero: "",
        vueloVueltaAeropuertoSalida: "",
        vueloVueltaAeropuertoLlegada: "",
      }),
      setValue as never,
      getValues as never,
    );

    const paths = setValue.mock.calls.map(([path]) => path);
    expect(paths).toContain("vueloIdaNumero");
    expect(paths).not.toContain("aerolinea");
    expect(paths).not.toContain("fechaIda");
  });
});
