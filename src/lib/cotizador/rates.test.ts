import { describe, expect, it } from "vitest";
import { DEFAULT_FORMULA_PARAMS } from "@/lib/cotizador/params";
import {
  buildRatesApiResponse,
  convertCatalogAmountToForm,
  type FxRatesMap,
  isFxRatesMap,
  normalizeSheetRates,
  parseRatesCsv,
  pickFxRatesMap,
  RatesError,
} from "@/lib/cotizador/rates";

const VALID_SHEET = {
  USD: 1,
  CLP: 950,
  ARS: 1420,
  PEN: 3.75,
  COP: 4100,
  MXN: 17.2,
  BRL: 5.5,
};

describe("convertCatalogAmountToForm", () => {
  const rates: FxRatesMap = {
    USD: 1,
    ARS: 1450,
    CLP: 950,
    COP: 10_000,
    PIX: 5.5,
    PEN: 3.75,
  };

  it("converts ARS catalog amount to USD", () => {
    expect(convertCatalogAmountToForm(1450, "ARS", "USD", rates)).toBe(1);
  });

  it("converts ARS catalog amount to COP via USD", () => {
    expect(convertCatalogAmountToForm(1450, "ARS", "COP", rates)).toBe(10_000);
  });

  it("leaves USD catalog amount as-is when target is USD", () => {
    expect(convertCatalogAmountToForm(50, "USD", "USD", rates)).toBe(50);
  });

  it("converts USD catalog amount to ARS", () => {
    expect(convertCatalogAmountToForm(2, "USD", "ARS", rates)).toBe(2900);
  });
});

describe("normalizeSheetRates", () => {
  it("maps BRL to PIX and keeps form currencies", () => {
    const rates = normalizeSheetRates(VALID_SHEET);
    expect(rates).toEqual({
      USD: 1,
      ARS: 1420,
      CLP: 950,
      COP: 4100,
      PEN: 3.75,
      PIX: 5.5,
    });
    expect(rates).not.toHaveProperty("BRL");
    expect(rates).not.toHaveProperty("MXN");
  });

  it("rejects missing BRL", () => {
    const rest = {
      USD: VALID_SHEET.USD,
      CLP: VALID_SHEET.CLP,
      ARS: VALID_SHEET.ARS,
      PEN: VALID_SHEET.PEN,
      COP: VALID_SHEET.COP,
      MXN: VALID_SHEET.MXN,
    };
    expect(() => normalizeSheetRates(rest)).toThrow(RatesError);
    expect(() => normalizeSheetRates(rest)).toThrow(/BRL/);
  });

  it("rejects non-positive or non-finite rates", () => {
    expect(() => normalizeSheetRates({ ...VALID_SHEET, CLP: 0 })).toThrow(
      RatesError,
    );
    expect(() =>
      normalizeSheetRates({ ...VALID_SHEET, ARS: Number.NaN }),
    ).toThrow(RatesError);
    expect(() => normalizeSheetRates({ ...VALID_SHEET, COP: -1 })).toThrow(
      RatesError,
    );
  });

  it("rejects USD far from 1", () => {
    expect(() => normalizeSheetRates({ ...VALID_SHEET, USD: 1.5 })).toThrow(
      /USD/,
    );
  });
});

describe("parseRatesCsv", () => {
  it("parses two-line CSV and maps BRL → PIX", () => {
    const csv = [
      "USD,CLP,ARS,PEN,COP,MXN,BRL",
      "1,950,1420,3.75,4100,17.2,5.5",
    ].join("\n");

    expect(parseRatesCsv(csv)).toEqual({
      USD: 1,
      ARS: 1420,
      CLP: 950,
      COP: 4100,
      PEN: 3.75,
      PIX: 5.5,
    });
  });

  it("rejects empty or single-line CSV", () => {
    expect(() => parseRatesCsv("")).toThrow(RatesError);
    expect(() => parseRatesCsv("USD,ARS\n")).toThrow(RatesError);
  });

  it("rejects header/value length mismatch", () => {
    expect(() => parseRatesCsv("USD,ARS,BRL\n1,1420")).toThrow(/mismatch/);
  });
});

describe("pickFxRatesMap / buildRatesApiResponse", () => {
  const flatRates: FxRatesMap = {
    USD: 1,
    ARS: 1420,
    CLP: 950,
    COP: 4100,
    PIX: 5.5,
    PEN: 3.75,
  };

  it("isFxRatesMap accepts flat rates plus formulaParams sibling", () => {
    expect(
      isFxRatesMap({ ...flatRates, formulaParams: DEFAULT_FORMULA_PARAMS }),
    ).toBe(true);
  });

  it("pickFxRatesMap strips formulaParams", () => {
    const picked = pickFxRatesMap(buildRatesApiResponse(flatRates));
    expect(picked).toEqual(flatRates);
    expect(picked).not.toHaveProperty("formulaParams");
  });

  it("buildRatesApiResponse adds DEFAULT_FORMULA_PARAMS", () => {
    const payload = buildRatesApiResponse(flatRates);
    expect(payload.formulaParams).toEqual(DEFAULT_FORMULA_PARAMS);
    expect(payload.USD).toBe(1);
    expect(payload.ARS).toBe(1420);
  });

  it("pickFxRatesMap returns null for incomplete maps", () => {
    expect(pickFxRatesMap({ USD: 1 })).toBeNull();
  });
});
