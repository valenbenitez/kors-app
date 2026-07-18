import { beforeEach, describe, expect, test, vi } from "vitest";

const getSession = vi.fn();
const formToFormulaInput = vi.fn();
const calcularCotizacion = vi.fn();
const generateCotNumber = vi.fn();
const clientPdfFilename = vi.fn();
const renderPdfHtml = vi.fn();
const htmlToPdf = vi.fn();
const createTripQuote = vi.fn();
const safeParse = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getSession: (...args: unknown[]) => getSession(...args),
}));

vi.mock("@/lib/cotizador/build-input", () => ({
  formToFormulaInput: (...args: unknown[]) => formToFormulaInput(...args),
}));

vi.mock("@/lib/cotizador/formula", () => ({
  calcularCotizacion: (...args: unknown[]) => calcularCotizacion(...args),
  FormulaError: class FormulaError extends Error {},
}));

vi.mock("@/lib/pdf/cot-number", () => ({
  generateCotNumber: (...args: unknown[]) => generateCotNumber(...args),
  clientPdfFilename: (...args: unknown[]) => clientPdfFilename(...args),
}));

vi.mock("@/lib/pdf/template", () => ({
  renderPdfHtml: (...args: unknown[]) => renderPdfHtml(...args),
}));

vi.mock("@/lib/pdf/generate", () => ({
  htmlToPdf: (...args: unknown[]) => htmlToPdf(...args),
}));

vi.mock("@/lib/firebase/trip-quotes/repository", () => ({
  createTripQuote: (...args: unknown[]) => createTripQuote(...args),
}));

vi.mock("@/lib/validations/cotizacion", () => ({
  cotizacionFormSchema: {
    safeParse: (...args: unknown[]) => safeParse(...args),
  },
}));

import { POST } from "@/app/api/generate-pdf/route";
import { FormulaError } from "@/lib/cotizador/formula";

function jsonRequest(body: unknown = {}): Request {
  return new Request("http://localhost/api/generate-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const formBody = { clienteNombre: "Ana" };
const formulaResult = { precioFinalCliente: 100 };

function mockHappyPath() {
  getSession.mockResolvedValue({ email: "a@kors.com", sub: "uid-1" });
  safeParse.mockReturnValue({ success: true as const, data: formBody });
  formToFormulaInput.mockReturnValue({});
  calcularCotizacion.mockReturnValue(formulaResult);
  generateCotNumber.mockReturnValue("COT-0001");
  clientPdfFilename.mockReturnValue("COT-0001.pdf");
  renderPdfHtml.mockReturnValue("<html></html>");
  htmlToPdf.mockResolvedValue(Buffer.from("%PDF"));
  createTripQuote.mockResolvedValue("doc-id-1");
}

describe("POST /api/generate-pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns 401 when there is no session and does not persist", async () => {
    getSession.mockResolvedValue(null);

    const response = await POST(jsonRequest());
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autorizado");
    expect(htmlToPdf).not.toHaveBeenCalled();
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
    expect(htmlToPdf).not.toHaveBeenCalled();
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
    expect(htmlToPdf).not.toHaveBeenCalled();
    expect(createTripQuote).not.toHaveBeenCalled();
  });

  test("persists trip quote and returns PDF on happy path", async () => {
    mockHappyPath();

    const response = await POST(jsonRequest(formBody));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(htmlToPdf).toHaveBeenCalledOnce();
    expect(createTripQuote).toHaveBeenCalledExactlyOnceWith({
      cotNumber: "COT-0001",
      status: "generated",
      form: formBody,
      result: formulaResult,
      createdBy: { uid: "uid-1", email: "a@kors.com" },
    });
  });

  test("fails the request with Spanish error when persist fails after PDF", async () => {
    mockHappyPath();
    createTripQuote.mockRejectedValue(new Error("firestore unavailable"));

    const response = await POST(jsonRequest(formBody));
    const data = await response.json();

    expect(htmlToPdf).toHaveBeenCalledOnce();
    expect(createTripQuote).toHaveBeenCalledOnce();
    expect(response.status).toBe(500);
    expect(data.error).toBe(
      "No se pudo guardar la cotización. Intentá de nuevo.",
    );
    expect(response.headers.get("Content-Type")).not.toBe("application/pdf");
  });
});
