import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const getSession = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getSession: (...args: unknown[]) => getSession(...args),
}));

import { handleCotizacionByIdGet } from "@/app/api/cotizaciones/[id]/route";
import { TripQuoteNotFoundError } from "@/lib/firebase/errors";
import type { TripQuoteDoc } from "@/lib/firebase/trip-quotes/types";

function getRequest(): Request {
  return new Request("http://localhost/api/cotizaciones/doc-1", {
    method: "GET",
  });
}

function sampleDoc(overrides: Partial<TripQuoteDoc> = {}): TripQuoteDoc {
  return {
    id: "doc-1",
    cotNumber: "COT-0001",
    status: "generated",
    createdAt: new Date("2026-07-01T12:00:00.000Z"),
    updatedAt: new Date("2026-07-01T12:00:00.000Z"),
    createdBy: { uid: "owner-uid", email: "owner@kors.com" },
    form: { clienteNombre: "Ana" } as TripQuoteDoc["form"],
    result: { precioFinalCliente: 150 } as TripQuoteDoc["result"],
    precioFinalCliente: 150,
    clienteNombre: "Ana",
    ...overrides,
  };
}

const prevAdminEmails = process.env.ADMIN_EMAILS;

afterEach(() => {
  if (prevAdminEmails === undefined) {
    delete process.env.ADMIN_EMAILS;
  } else {
    process.env.ADMIN_EMAILS = prevAdminEmails;
  }
});

describe("GET /api/cotizaciones/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ADMIN_EMAILS;
  });

  test("returns 401 when unauthenticated", async () => {
    getSession.mockResolvedValue(null);
    const getTripQuoteById = vi.fn();

    const response = await handleCotizacionByIdGet(getRequest(), "doc-1", {
      getTripQuoteById,
    });

    expect(response.status).toBe(401);
    expect(getTripQuoteById).not.toHaveBeenCalled();
  });

  test("returns 404 when quote is missing", async () => {
    getSession.mockResolvedValue({ email: "a@kors.com", sub: "uid-1" });
    const getTripQuoteById = vi.fn(async () => {
      throw new TripQuoteNotFoundError("doc-1");
    });

    const response = await handleCotizacionByIdGet(getRequest(), "doc-1", {
      getTripQuoteById,
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Cotización no encontrada");
  });

  test("owner can get own quote by id", async () => {
    getSession.mockResolvedValue({ email: "owner@kors.com", sub: "owner-uid" });
    const doc = sampleDoc();
    const getTripQuoteById = vi.fn(async () => doc);

    const response = await handleCotizacionByIdGet(getRequest(), "doc-1", {
      getTripQuoteById,
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.item.cotNumber).toBe("COT-0001");
    expect(data.item.createdBy.email).toBe("owner@kors.com");
  });

  test("returns 403 when seller reads another seller quote", async () => {
    getSession.mockResolvedValue({ email: "other@kors.com", sub: "other-uid" });
    const getTripQuoteById = vi.fn(async () => sampleDoc());

    const response = await handleCotizacionByIdGet(getRequest(), "doc-1", {
      getTripQuoteById,
    });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Prohibido");
  });

  test("admin can get another seller quote via claim", async () => {
    getSession.mockResolvedValue({
      email: "admin@kors.com",
      sub: "admin-uid",
      admin: true,
    });
    const getTripQuoteById = vi.fn(async () => sampleDoc());

    const response = await handleCotizacionByIdGet(getRequest(), "doc-1", {
      getTripQuoteById,
    });

    expect(response.status).toBe(200);
  });

  test("resolves COT-XXXX via getTripQuoteByCotNumber", async () => {
    getSession.mockResolvedValue({ email: "owner@kors.com", sub: "owner-uid" });
    const getTripQuoteByCotNumber = vi.fn(async () => sampleDoc());
    const getTripQuoteById = vi.fn();

    const response = await handleCotizacionByIdGet(getRequest(), "cot-0001", {
      getTripQuoteByCotNumber,
      getTripQuoteById,
    });

    expect(response.status).toBe(200);
    expect(getTripQuoteByCotNumber).toHaveBeenCalledExactlyOnceWith("COT-0001");
    expect(getTripQuoteById).not.toHaveBeenCalled();
  });
});
