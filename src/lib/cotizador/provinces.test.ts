import { describe, expect, it } from "vitest";
import {
  excursionsForSelection,
  provinceToCatalogDestino,
} from "@/lib/cotizador/provinces";

describe("provinceToCatalogDestino", () => {
  it("maps Misiones to Iguazú", () => {
    expect(provinceToCatalogDestino("Misiones")).toBe("Iguazú");
  });

  it("maps CABA to Buenos Aires", () => {
    expect(provinceToCatalogDestino("CABA")).toBe("Buenos Aires");
  });

  it("maps Uruguay to Uruguay", () => {
    expect(provinceToCatalogDestino("Uruguay")).toBe("Uruguay");
  });

  it("returns null for provinces without catalog coverage", () => {
    expect(provinceToCatalogDestino("Córdoba")).toBeNull();
    expect(provinceToCatalogDestino("Tucumán")).toBeNull();
  });

  it("maps Bariloche-region provinces to Bariloche", () => {
    expect(provinceToCatalogDestino("Río Negro")).toBe("Bariloche");
    expect(provinceToCatalogDestino("Neuquén")).toBe("Bariloche");
  });
});

describe("excursionsForSelection", () => {
  const fechaIda = "2026-07-15";

  it("returns catalog excursions when the province maps to a catalog destino", () => {
    const results = excursionsForSelection({
      selection: "Misiones",
      fechaIda,
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((e) => e.destino === "Iguazú")).toBe(true);
  });

  it("returns an empty list when the province has no catalog map", () => {
    expect(excursionsForSelection({ selection: "Córdoba", fechaIda })).toEqual(
      [],
    );
  });
});
