import { describe, expect, it } from "vitest";
import { filterExcursions, normalizeSearchText } from "@/lib/cotizador/catalog";

describe("normalizeSearchText", () => {
  it("lowercases, strips diacritics, and collapses whitespace", () => {
    expect(normalizeSearchText("  Catarátas   del   Iguazú  ")).toBe(
      "cataratas del iguazu",
    );
  });

  it("treats accented and plain forms as equal after normalize", () => {
    expect(normalizeSearchText("Catarátas")).toBe(
      normalizeSearchText("cataratas"),
    );
    expect(normalizeSearchText("Náutico")).toBe(normalizeSearchText("nautico"));
  });
});

describe("filterExcursions — name search", () => {
  const fechaIda = "2026-07-15";

  it("returns all valid excursions for a destination when query is empty", () => {
    const withoutQuery = filterExcursions({
      destino: "Iguazú",
      fechaIda,
    });
    const withEmptyQuery = filterExcursions({
      destino: "Iguazú",
      fechaIda,
      query: "   ",
    });

    expect(withoutQuery.length).toBeGreaterThan(0);
    expect(withEmptyQuery).toEqual(withoutQuery);
  });

  it("matches names ignoring case and accents", () => {
    const plain = filterExcursions({
      destino: "Iguazú",
      fechaIda,
      query: "cat",
    });
    const accented = filterExcursions({
      destino: "Iguazú",
      fechaIda,
      query: "Cát",
    });

    expect(plain.length).toBeGreaterThan(0);
    expect(accented.map((e) => e.id).sort()).toEqual(
      plain.map((e) => e.id).sort(),
    );
    expect(
      plain.every(
        (e) =>
          normalizeSearchText(e.nombre).includes("cat") ||
          normalizeSearchText(e.nombreLimpio).includes("cat"),
      ),
    ).toBe(true);
  });

  it("never returns excursions from another destination with the same title", () => {
    const sharedTitle =
      "Transfer In/Out - POR PERSONA - POR TRAMO (TIEMPO LIBRE)";
    const fechaShared = "2026-06-15";

    const calafate = filterExcursions({
      destino: "Calafate",
      fechaIda: fechaShared,
      query: "transfer in/out",
    });
    const ushuaia = filterExcursions({
      destino: "Ushuaia",
      fechaIda: fechaShared,
      query: "transfer in/out",
    });

    expect(calafate.some((e) => e.nombre === sharedTitle)).toBe(true);
    expect(ushuaia.some((e) => e.nombre === sharedTitle)).toBe(true);
    expect(calafate.every((e) => e.destino === "Calafate")).toBe(true);
    expect(ushuaia.every((e) => e.destino === "Ushuaia")).toBe(true);
    const calafateIds = new Set(calafate.map((e) => e.id));
    expect(ushuaia.every((e) => !calafateIds.has(e.id))).toBe(true);
  });

  it("returns an empty list when the query has no matches in the destination", () => {
    const results = filterExcursions({
      destino: "Iguazú",
      fechaIda,
      query: "zzzz-no-match-xyz",
    });
    expect(results).toEqual([]);
  });
});
