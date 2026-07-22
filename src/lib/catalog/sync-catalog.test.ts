import { describe, expect, it, vi } from "vitest";
import type { EditorialDoc } from "@/lib/catalog/parse-editorial";
import { syncCatalog } from "@/lib/catalog/sync-catalog";
import type { CatalogSyncWriter } from "@/lib/catalog/sync-types";
import type { CatalogExcursion } from "@/lib/cotizador/catalog";

function createMemoryWriter(): CatalogSyncWriter & {
  excursions: Map<string, CatalogExcursion>;
  editorial: Map<string, EditorialDoc>;
  syncMeta: Array<{ source: string; written: number; errorCount: number }>;
} {
  const excursions = new Map<string, CatalogExcursion>();
  const editorial = new Map<string, EditorialDoc>();
  const syncMeta: Array<{
    source: string;
    written: number;
    errorCount: number;
  }> = [];

  return {
    excursions,
    editorial,
    syncMeta,
    async upsertExcursion(excursion) {
      excursions.set(excursion.id, excursion);
    },
    async upsertEditorial(doc) {
      editorial.set(`${doc.destino}__${doc.tipo}`, doc);
    },
    async markSynced(meta) {
      syncMeta.push(meta);
    },
  };
}

const EXCURSIONS_CSV = `id,nombre,activa,destino,moneda,neto,precioMenor,politicaMenores,proveedor,observaciones,notas,tipo,validezDesde,validezHasta,categoriaPaquete
exc-a,Tour A,true,Iguazú,USD,10,,Mismo adulto,P,,,Excursion,,,Base
bad-row,,true,Iguazú,USD,10,,Mismo adulto,P,,,Excursion,,,Base
exc-a,Tour A updated,true,Iguazú,USD,20,,Mismo adulto,P,,,Excursion,,,Base
`;

const EDITORIAL_CSV = `destino,tipo,payload
Iguazú,tips,"[{""emoji"":""💡"",""title"":""T"",""body"":""B""}]"
Iguazú,tips,BROKEN
`;

describe("syncCatalog", () => {
  it("upserts by id (idempotent) and collects row errors", async () => {
    const writer = createMemoryWriter();
    const summary = await syncCatalog(
      { excursionsCsv: EXCURSIONS_CSV, editorialCsv: EDITORIAL_CSV },
      writer,
    );

    expect(writer.excursions.size).toBe(1);
    expect(writer.excursions.get("exc-a")?.neto).toBe(20);
    expect(writer.editorial.size).toBe(1);
    expect(summary.written).toBe(3); // 2 excursion upserts + 1 editorial
    expect(summary.errors).toHaveLength(2);
    expect(summary.errors.some((e) => e.source === "excursions")).toBe(true);
    expect(summary.errors.some((e) => e.source === "editorial")).toBe(true);
    expect(writer.syncMeta).toHaveLength(1);
    expect(writer.syncMeta[0]?.source).toBe("sheet");
  });

  it("seeds from static when CSVs are missing", async () => {
    const writer = createMemoryWriter();
    const summary = await syncCatalog({ allowStaticSeed: true }, writer);

    expect(summary.source).toBe("static");
    expect(summary.written).toBeGreaterThan(0);
    expect(writer.excursions.size).toBeGreaterThan(0);
    expect(writer.editorial.has("Iguazú__tips")).toBe(true);
    expect(summary.errors).toEqual([]);
  });

  it("re-running the same CSV does not grow the id set", async () => {
    const writer = createMemoryWriter();
    const csv = `id,nombre,activa,destino,moneda,neto,precioMenor,politicaMenores,proveedor,observaciones,notas,tipo,validezDesde,validezHasta,categoriaPaquete
exc-1,One,true,Iguazú,USD,1,,Mismo adulto,P,,,Excursion,,,Base
`;
    await syncCatalog({ excursionsCsv: csv, editorialCsv: null }, writer);
    await syncCatalog({ excursionsCsv: csv, editorialCsv: null }, writer);

    expect(writer.excursions.size).toBe(1);
  });
});

describe("syncCatalog writer calls", () => {
  it("calls upsert once per valid row including duplicates", async () => {
    const upsertExcursion = vi.fn(async () => undefined);
    const upsertEditorial = vi.fn(async () => undefined);
    const markSynced = vi.fn(async () => undefined);

    const summary = await syncCatalog(
      { excursionsCsv: EXCURSIONS_CSV, editorialCsv: null },
      { upsertExcursion, upsertEditorial, markSynced },
    );

    expect(upsertExcursion).toHaveBeenCalledTimes(2);
    expect(summary.excursions.written).toBe(2);
    expect(summary.excursions.errors).toHaveLength(1);
  });
});
