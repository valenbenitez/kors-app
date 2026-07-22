import { describe, expect, it, vi } from "vitest";
import { FirestoreCatalogRepository } from "@/lib/catalog/firestore-repository";
import { catalogExcursionSchema } from "@/lib/catalog/schemas";

const getMock = vi.fn();
const whereMock = vi.fn(() => ({ get: getMock }));
const collectionMock = vi.fn(() => ({
  where: whereMock,
  doc: vi.fn((id: string) => ({
    get: vi.fn(async () => {
      if (id === "Iguazú__tips") {
        return {
          exists: true,
          data: () => ({
            destino: "Iguazú",
            tipo: "tips",
            payload: [{ emoji: "💡", title: "T", body: "B" }],
          }),
        };
      }
      return { exists: false, data: () => undefined };
    }),
  })),
}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: () => ({
    collection: (...args: unknown[]) => collectionMock(...args),
  }),
}));

describe("FirestoreCatalogRepository", () => {
  it("filters excursions from Firestore by destino + fechaIda", async () => {
    const valid = catalogExcursionSchema.parse({
      id: "exc-fs-1",
      nombre: "Tour FS",
      nombreLimpio: "Tour FS",
      activa: true,
      destino: "Iguazú",
      moneda: "USD",
      neto: 10,
      precioMenor: null,
      politicaMenores: "Mismo adulto",
      proveedor: "P",
      observaciones: "",
      notas: "",
      tipo: "Excursion",
      validezDesde: null,
      validezHasta: null,
      categoriaPaquete: "Base",
    });

    getMock.mockResolvedValue({
      docs: [{ data: () => valid }],
    });

    const repo = new FirestoreCatalogRepository();
    const result = await repo.get("excursiones", {
      destino: "Misiones",
      fechaIda: "2026-08-10",
    });

    expect(result).toEqual({ items: [valid] });
    expect(collectionMock).toHaveBeenCalled();
  });

  it("reads tips editorial blob", async () => {
    const repo = new FirestoreCatalogRepository();
    const result = await repo.get("tips", { destino: "Misiones" });
    expect(result).toEqual({
      items: [{ emoji: "💡", title: "T", body: "B" }],
    });
  });

  it("returns empty tips when editorial doc missing", async () => {
    const repo = new FirestoreCatalogRepository();
    const result = await repo.get("tips", { destino: "Mendoza" });
    expect(result).toEqual({ items: [] });
  });
});
