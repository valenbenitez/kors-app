import { beforeEach, describe, expect, test, vi } from "vitest";

const getSession = vi.fn();
const safeParse = vi.fn();
const computePremiumTag = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getSession: (...args: unknown[]) => getSession(...args),
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

vi.mock("@/lib/cotizador/premium", () => ({
  computePremiumTag: (...args: unknown[]) => computePremiumTag(...args),
}));

vi.mock("@/lib/cotizador/formula", () => ({
  FormulaError: class FormulaError extends Error {},
}));

import { handleCotizacionesPost } from "@/app/api/cotizaciones/route";
import { FormulaError } from "@/lib/cotizador/formula";
import type { DriveClient } from "@/lib/drive";
import { DriveUploadError } from "@/lib/drive";
import { FirebaseDomainError } from "@/lib/firebase/errors";

function jsonRequest(body: unknown = {}): Request {
  return new Request("http://localhost/api/cotizaciones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const formBody = {
  clienteNombre: "Ana",
  perfil: "Pareja",
};
const formulaResult = {
  subtotalUsd: 100,
  margenAgenciaUsd: 30,
  margenVendedorUsd: 5,
  precioFinalCliente: 150,
  tcArsUsd: 1420,
};

function mockDrive(url: string | null = null): DriveClient {
  return {
    uploadPdf: vi.fn(async (input) => ({
      url,
      fileId: url ? "file-1" : null,
      storagePath: input.storagePath,
    })),
  };
}

function builtPdf(cotNumber: string) {
  return {
    cotNumber,
    filename: `${cotNumber}_cliente.pdf`,
    pdf: Buffer.from("%PDF"),
    form: formBody,
    result: formulaResult,
    generatedAt: "2026-07-21",
  };
}

describe("POST /api/cotizaciones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    computePremiumTag.mockReturnValue(false);
  });

  test("returns 401 when there is no session", async () => {
    getSession.mockResolvedValue(null);
    const createTripQuote = vi.fn();

    const response = await handleCotizacionesPost(jsonRequest(), {
      createTripQuote,
    });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autorizado");
    expect(createTripQuote).not.toHaveBeenCalled();
  });

  test("returns 400 when Zod validation fails", async () => {
    getSession.mockResolvedValue({ email: "a@kors.com", sub: "uid-1" });
    safeParse.mockReturnValue({
      success: false as const,
      error: { issues: [{ message: "Cliente requerido" }] },
    });
    const createTripQuote = vi.fn();

    const response = await handleCotizacionesPost(jsonRequest({}), {
      createTripQuote,
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Cliente requerido");
    expect(createTripQuote).not.toHaveBeenCalled();
  });

  test("happy path with noop Drive returns null pdf_drive_url", async () => {
    getSession.mockResolvedValue({ email: "a@kors.com", sub: "uid-1" });
    safeParse.mockReturnValue({ success: true as const, data: formBody });
    const drive = mockDrive(null);
    const createTripQuote = vi.fn(async () => "doc-1");
    const updateTripQuoteDriveFields = vi.fn();

    const response = await handleCotizacionesPost(jsonRequest(formBody), {
      drive,
      allocateCotNumber: async () => "COT-0001",
      buildQuotePdf: vi.fn(async () => builtPdf("COT-0001")) as never,
      createTripQuote: createTripQuote as never,
      updateTripQuoteDriveFields: updateTripQuoteDriveFields as never,
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      cot_number: "COT-0001",
      pdf_drive_url: null,
      saved_at: expect.any(String),
    });
    expect(drive.uploadPdf).toHaveBeenCalledOnce();
    expect(createTripQuote).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        cotNumber: "COT-0001",
        status: "generated",
        pdfClienteUrl: null,
        driveFileId: null,
        roundingRule: "CEILING_v1",
        costoNetoUsd: 100,
        premiumTag: false,
        clienteNombre: "Ana",
        perfil: "Pareja",
      }),
    );
    expect(updateTripQuoteDriveFields).not.toHaveBeenCalled();
  });

  test("happy path with injected Drive persists then patches url", async () => {
    getSession.mockResolvedValue({ email: "a@kors.com", sub: "uid-1" });
    safeParse.mockReturnValue({ success: true as const, data: formBody });
    const driveUrl = "https://drive.google.com/file/d/abc/view";
    const drive = mockDrive(driveUrl);
    const createTripQuote = vi.fn(async () => "doc-1");
    const updateTripQuoteDriveFields = vi.fn(async () => undefined);

    const response = await handleCotizacionesPost(jsonRequest(formBody), {
      drive,
      allocateCotNumber: async () => "COT-0042",
      buildQuotePdf: vi.fn(async () => builtPdf("COT-0042")) as never,
      createTripQuote: createTripQuote as never,
      updateTripQuoteDriveFields: updateTripQuoteDriveFields as never,
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.cot_number).toBe("COT-0042");
    expect(data.pdf_drive_url).toBe(driveUrl);
    expect(createTripQuote).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        pdfClienteUrl: null,
        driveFileId: null,
      }),
    );
    expect(updateTripQuoteDriveFields).toHaveBeenCalledExactlyOnceWith(
      "doc-1",
      {
        pdfClienteUrl: driveUrl,
        pdfStoragePath: expect.stringContaining("COT-0042.pdf"),
        driveFileId: "file-1",
      },
    );
  });

  test("Drive upload failure still returns 200 after persist (null url)", async () => {
    getSession.mockResolvedValue({ email: "a@kors.com", sub: "uid-1" });
    safeParse.mockReturnValue({ success: true as const, data: formBody });
    const createTripQuote = vi.fn(async () => "doc-1");
    const updateTripQuoteDriveFields = vi.fn();
    const drive: DriveClient = {
      uploadPdf: vi.fn(async () => {
        throw new DriveUploadError("Drive upload failed");
      }),
    };

    const response = await handleCotizacionesPost(jsonRequest(formBody), {
      drive,
      allocateCotNumber: async () => "COT-0001",
      buildQuotePdf: vi.fn(async () => builtPdf("COT-0001")) as never,
      createTripQuote: createTripQuote as never,
      updateTripQuoteDriveFields: updateTripQuoteDriveFields as never,
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.cot_number).toBe("COT-0001");
    expect(data.pdf_drive_url).toBeNull();
    expect(createTripQuote).toHaveBeenCalledOnce();
    expect(updateTripQuoteDriveFields).not.toHaveBeenCalled();
  });

  test("returns 500 with explicit error when Firestore persist fails", async () => {
    getSession.mockResolvedValue({ email: "a@kors.com", sub: "uid-1" });
    safeParse.mockReturnValue({ success: true as const, data: formBody });
    const drive = mockDrive(null);

    const response = await handleCotizacionesPost(jsonRequest(formBody), {
      drive,
      allocateCotNumber: async () => "COT-0001",
      buildQuotePdf: vi.fn(async () => builtPdf("COT-0001")) as never,
      createTripQuote: vi.fn(async () => {
        throw new FirebaseDomainError("createTripQuote: unavailable");
      }) as never,
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("createTripQuote: unavailable");
    expect(drive.uploadPdf).not.toHaveBeenCalled();
  });

  test("returns 422 when formula fails", async () => {
    getSession.mockResolvedValue({ email: "a@kors.com", sub: "uid-1" });
    safeParse.mockReturnValue({ success: true as const, data: formBody });

    const response = await handleCotizacionesPost(jsonRequest(formBody), {
      drive: mockDrive(null),
      allocateCotNumber: async () => "COT-0001",
      buildQuotePdf: vi.fn(async () => {
        throw new FormulaError("TC inválido");
      }) as never,
    });
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toBe("TC inválido");
  });
});
