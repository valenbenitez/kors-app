import type { EditorialDoc } from "@/lib/catalog/parse-editorial";
import type { CatalogExcursion } from "@/lib/cotizador/catalog";

export type SyncRowError = {
  source: "excursions" | "editorial";
  row: number;
  error: string;
};

export type CatalogSyncSummary = {
  source: "sheet" | "static";
  excursions: { written: number; errors: SyncRowError[] };
  editorial: { written: number; errors: SyncRowError[] };
  written: number;
  errors: SyncRowError[];
};

export type CatalogSyncWriter = {
  upsertExcursion: (excursion: CatalogExcursion) => Promise<void>;
  upsertEditorial: (doc: EditorialDoc) => Promise<void>;
  markSynced: (meta: {
    source: "sheet" | "static";
    written: number;
    errorCount: number;
  }) => Promise<void>;
};

export type CatalogSyncInput = {
  excursionsCsv?: string | null;
  editorialCsv?: string | null;
  /** When both CSVs are missing, seed from bundled static data. */
  allowStaticSeed?: boolean;
};
