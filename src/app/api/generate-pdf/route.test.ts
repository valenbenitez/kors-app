import { beforeEach, describe, expect, test, vi } from "vitest";

const getSession = vi.fn();
const buildQuotePdf = vi.fn();
const allocateCotNumber = vi.fn();
const createTripQuote = vi.fn();
const safeParse = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getSession: (...args: unknown[]) => getSession(...args),
}));

vi.mock("@/lib/cotizador/build-quote-pdf", () => ({
  buildQuotePdf: (...args: unknown[]) => buildQuotePdf(...args),
}));

vi.mock("@/lib/firebase/counters/cotizaciones", () => ({
  allocateCotNumber: (...args: unknown[]) => allocateCotNumber(...args),
}));

vi.mock("@/lib/firebase/trip-quotes/repository", () => ({
  createTripQuote: (...args: unknown[]) => createTripQuote(...args),
}));

vi.mock("@/lib/cotizador/formula", () => ({
  FormulaError: class FormulaError extends Error {},
}));

vi.mock("@/lib/validations/cotizacion", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/validations/cotizacion")>();
  return {
    ...actual,
    cotizacionFormSchema: {
      safeParse: (...args: unknown[]) => safeParse(...args),
    },
  };
});

import { POST } from "@/app/api/generate-pdf/route";
import { FormulaError } from "@/lib/cotizador/formula";

function jsonRequest(body: unknown = {}): Request {
  return new Request("http://localhost/api/generate-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const formBody = {
  clienteNombre: "Ana",
  perfil: "Pareja",
  paquetePremium: false,
};
const formulaResult = {
  precioFinalCliente: 100,
  subtotalUsd: 70,
  margenAgenciaUsd: 20,
  margenVendedorUsd: 5,
};

function mockHappyPath() {
  getSession.mockResolvedValue({ email: "a@kors.com", sub: "uid-1" });
  safeParse.mockReturnValue({ success: true as const, data: formBody });
  allocateCotNumber.mockResolvedValue("COT-0001");
  buildQuotePdf.mockResolvedValue({
    cotNumber: "COT-0001",
    filename: "COT-0001_cliente.pdf",
    pdf: Buffer.from("%PDF"),
    form: formBody,
    result: formulaResult,
    generatedAt: "2026-07-21",
  });
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
    expect(buildQuotePdf).not.toHaveBeenCalled();
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
    expect(buildQuotePdf).not.toHaveBeenCalled();
    expect(createTripQuote).not.toHaveBeenCalled();
  });

  test("returns 422 when formula fails and does not persist", async () => {
    getSession.mockResolvedValue({ email: "a@kors.com", sub: "uid-1" });
    safeParse.mockReturnValue({ success: true as const, data: formBody });
    allocateCotNumber.mockResolvedValue("COT-0001");
    buildQuotePdf.mockRejectedValue(new FormulaError("TC inválido"));

    const response = await POST(jsonRequest(formBody));
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toBe("TC inválido");
    expect(createTripQuote).not.toHaveBeenCalled();
  });

  test("persists trip quote and returns PDF on happy path", async () => {
    mockHappyPath();

    const response = await POST(jsonRequest(formBody));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(allocateCotNumber).toHaveBeenCalledOnce();
    expect(buildQuotePdf).toHaveBeenCalledExactlyOnceWith(formBody, "COT-0001");
    expect(createTripQuote).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        cotNumber: "COT-0001",
        status: "generated",
        form: formBody,
        result: formulaResult,
        createdBy: { uid: "uid-1", email: "a@kors.com" },
        roundingRule: "CEILING_v1",
      }),
    );
  });

  test("fails the request with Spanish error when persist fails after PDF", async () => {
    mockHappyPath();
    createTripQuote.mockRejectedValue(new Error("firestore unavailable"));

    const response = await POST(jsonRequest(formBody));
    const data = await response.json();

    expect(buildQuotePdf).toHaveBeenCalledOnce();
    expect(createTripQuote).toHaveBeenCalledOnce();
    expect(response.status).toBe(500);
    expect(data.error).toBe(
      "No se pudo guardar la cotización. Intentá de nuevo.",
    );
    expect(response.headers.get("Content-Type")).not.toBe("application/pdf");
  });
});
