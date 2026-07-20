import { beforeEach, describe, expect, test, vi } from "vitest";

const getSession = vi.fn();
const formToFormulaInput = vi.fn();
const calcularCotizacion = vi.fn();
const renderPdfHtml = vi.fn();
const createTripQuote = vi.fn();
const safeParse = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getSession: (...args: unknown[]) => getSession(...args),
}));

vi.mock("@/lib/cotizador/build-input", () => ({
  formToFormulaInput: (...args: unknown[]) => formToFormulaInput(...args),
}));

vi.mock("@/lib/cotizador/rates", () => ({
  resolveRates: vi.fn(async () => ({
    rates: {
      USD: 1,
      ARS: 1420,
      CLP: 950,
      COP: 4100,
      PIX: 5.5,
      PEN: 3.75,
    },
    source: "fallback" as const,
  })),
}));

vi.mock("@/lib/cotizador/formula", () => ({
  calcularCotizacion: (...args: unknown[]) => calcularCotizacion(...args),
  FormulaError: class FormulaError extends Error {},
}));

vi.mock("@/lib/pdf/template", () => ({
  renderPdfHtml: (...args: unknown[]) => renderPdfHtml(...args),
}));

vi.mock("@/lib/firebase/trip-quotes/repository", () => ({
  createTripQuote: (...args: unknown[]) => createTripQuote(...args),
}));

vi.mock("@/lib/validations/cotizacion", () => ({
  cotizacionFormSchema: {
    safeParse: (...args: unknown[]) => safeParse(...args),
  },
}));

import { POST, PREVIEW_COT_NUMBER } from "@/app/api/preview-pdf/route";
import { FormulaError } from "@/lib/cotizador/formula";

function jsonRequest(body: unknown = {}): Request {
  return new Request("http://localhost/api/preview-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const formBody = { clienteNombre: "Ana" };
const formulaResult = { precioFinalCliente: 100 };
const SAMPLE_HTML =
  '<!DOCTYPE html><html><body><section class="page">COT-PREVIEW</section></body></html>';

function mockHappyPath() {
  getSession.mockResolvedValue({ email: "a@kors.com", sub: "uid-1" });
  safeParse.mockReturnValue({ success: true as const, data: formBody });
  formToFormulaInput.mockReturnValue({});
  calcularCotizacion.mockReturnValue(formulaResult);
  renderPdfHtml.mockReturnValue(SAMPLE_HTML);
}

describe("POST /api/preview-pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns 401 when there is no session and does not persist", async () => {
    getSession.mockResolvedValue(null);

    const response = await POST(jsonRequest());
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autorizado");
    expect(renderPdfHtml).not.toHaveBeenCalled();
    expect(createTripQuote).not.toHaveBeenCalled();
  });

  test("returns 400 when Zod validation fails and does not persist", async () => {
    getSession.mockResolvedValue({ email: "a@kors.com", sub: "uid-1" });
    safeParse.mockReturnValue({
      success: false as const,
      error: {
        issues: [{ message: "Cliente requerido" }],
      },
    });

    const response = await POST(jsonRequest({}));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Cliente requerido");
    expect(renderPdfHtml).not.toHaveBeenCalled();
    expect(createTripQuote).not.toHaveBeenCalled();
  });

  test("returns 422 when formula fails and does not persist", async () => {
    getSession.mockResolvedValue({ email: "a@kors.com", sub: "uid-1" });
    safeParse.mockReturnValue({ success: true as const, data: formBody });
    formToFormulaInput.mockReturnValue({});
    calcularCotizacion.mockImplementation(() => {
      throw new FormulaError("TC inválido");
    });

    const response = await POST(jsonRequest(formBody));
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toBe("TC inválido");
    expect(renderPdfHtml).not.toHaveBeenCalled();
    expect(createTripQuote).not.toHaveBeenCalled();
  });

  test("returns HTML with expected markers and does not call createTripQuote", async () => {
    mockHappyPath();

    const response = await POST(jsonRequest(formBody));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/html; charset=utf-8",
    );
    expect(response.headers.get("X-Cotizacion-Numero")).toBe(
      PREVIEW_COT_NUMBER,
    );
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('class="page"');
    expect(html).toContain(PREVIEW_COT_NUMBER);
    expect(renderPdfHtml).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        cotNumber: PREVIEW_COT_NUMBER,
        form: formBody,
        result: formulaResult,
      }),
    );
    expect(createTripQuote).not.toHaveBeenCalled();
  });
});
