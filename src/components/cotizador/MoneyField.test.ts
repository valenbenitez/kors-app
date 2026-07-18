import { describe, expect, it } from "vitest";
import { CURRENCY_UI } from "@/components/cotizador/MoneyField";
import { MONEDAS } from "@/lib/validations/cotizacion";

describe("MoneyField currency UI", () => {
  it("defines decimals and prefix for every form currency", () => {
    for (const moneda of MONEDAS) {
      expect(CURRENCY_UI[moneda]).toBeDefined();
      expect(CURRENCY_UI[moneda].prefix.length).toBeGreaterThan(0);
      expect(CURRENCY_UI[moneda].decimals).toBeGreaterThanOrEqual(0);
    }
  });

  it("allows decimals for USD, PIX, and PEN", () => {
    expect(CURRENCY_UI.USD.decimals).toBe(2);
    expect(CURRENCY_UI.PIX.decimals).toBe(2);
    expect(CURRENCY_UI.PEN.decimals).toBe(2);
  });

  it("uses integer display for ARS, CLP, and COP", () => {
    expect(CURRENCY_UI.ARS.decimals).toBe(0);
    expect(CURRENCY_UI.CLP.decimals).toBe(0);
    expect(CURRENCY_UI.COP.decimals).toBe(0);
  });
});
