import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FORMULA_PARAMS } from "@/lib/cotizador/params";

const fetchMock = vi.fn();

describe("GET /api/rates", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", fetchMock);
    process.env.RATES_URL = "https://example.com/rates.csv";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    delete process.env.RATES_URL;
  });

  it("returns flat FX keys plus formulaParams", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () =>
        ["USD,CLP,ARS,PEN,COP,MXN,BRL", "1,950,1420,3.75,4100,17.2,5.5"].join(
          "\n",
        ),
    });

    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toMatchObject({
      USD: 1,
      ARS: 1420,
      CLP: 950,
      COP: 4100,
      PEN: 3.75,
      PIX: 5.5,
      formulaParams: DEFAULT_FORMULA_PARAMS,
    });
    expect(body).not.toHaveProperty("BRL");
  });

  it("returns 500 when RATES_URL is missing", async () => {
    delete process.env.RATES_URL;
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: "RATES_URL is not configured",
    });
  });
});
