import { parseCsv } from "@/lib/catalog/parse-csv";
import { parseEditorialCsvRows } from "@/lib/catalog/parse-editorial";
import { parseExcursionCsvRows } from "@/lib/catalog/parse-excursions";
import { buildStaticSeedPayload } from "@/lib/catalog/seed-static";
import type {
  CatalogSyncInput,
  CatalogSyncSummary,
  CatalogSyncWriter,
  SyncRowError,
} from "@/lib/catalog/sync-types";

/**
 * Syncs catalog data into the writer (Firestore upserts).
 *
 * - When CSV text is provided: parse + Zod-validate per row; invalid rows
 *   become errors and do not abort the rest.
 * - When CSVs are absent and `allowStaticSeed`: seed from bundled static data.
 * - Upserts by document id → idempotent re-runs.
 */
export async function syncCatalog(
  input: CatalogSyncInput,
  writer: CatalogSyncWriter,
): Promise<CatalogSyncSummary> {
  const hasExcursionsCsv = Boolean(input.excursionsCsv?.trim());
  const hasEditorialCsv = Boolean(input.editorialCsv?.trim());

  if (!hasExcursionsCsv && !hasEditorialCsv) {
    if (input.allowStaticSeed === false) {
      return emptySummary("sheet");
    }
    return syncFromStatic(writer);
  }

  const excursionErrors: SyncRowError[] = [];
  const editorialErrors: SyncRowError[] = [];
  let excursionsWritten = 0;
  let editorialWritten = 0;

  if (hasExcursionsCsv && input.excursionsCsv) {
    const { rows } = parseCsv(input.excursionsCsv);
    const results = parseExcursionCsvRows(rows);
    for (const result of results) {
      if (!result.ok) {
        excursionErrors.push({
          source: "excursions",
          row: result.row,
          error: result.error,
        });
        continue;
      }
      await writer.upsertExcursion(result.value);
      excursionsWritten += 1;
    }
  }

  if (hasEditorialCsv && input.editorialCsv) {
    const { rows } = parseCsv(input.editorialCsv);
    const results = parseEditorialCsvRows(rows);
    for (const result of results) {
      if (!result.ok) {
        editorialErrors.push({
          source: "editorial",
          row: result.row,
          error: result.error,
        });
        continue;
      }
      await writer.upsertEditorial(result.value);
      editorialWritten += 1;
    }
  }

  const errors = [...excursionErrors, ...editorialErrors];
  const written = excursionsWritten + editorialWritten;

  await writer.markSynced({
    source: "sheet",
    written,
    errorCount: errors.length,
  });

  return {
    source: "sheet",
    excursions: { written: excursionsWritten, errors: excursionErrors },
    editorial: { written: editorialWritten, errors: editorialErrors },
    written,
    errors,
  };
}

async function syncFromStatic(
  writer: CatalogSyncWriter,
): Promise<CatalogSyncSummary> {
  const { excursions, editorial } = buildStaticSeedPayload();
  let excursionsWritten = 0;
  let editorialWritten = 0;

  for (const excursion of excursions) {
    await writer.upsertExcursion(excursion);
    excursionsWritten += 1;
  }
  for (const doc of editorial) {
    await writer.upsertEditorial(doc);
    editorialWritten += 1;
  }

  const written = excursionsWritten + editorialWritten;
  await writer.markSynced({
    source: "static",
    written,
    errorCount: 0,
  });

  return {
    source: "static",
    excursions: { written: excursionsWritten, errors: [] },
    editorial: { written: editorialWritten, errors: [] },
    written,
    errors: [],
  };
}

function emptySummary(source: "sheet" | "static"): CatalogSyncSummary {
  return {
    source,
    excursions: { written: 0, errors: [] },
    editorial: { written: 0, errors: [] },
    written: 0,
    errors: [],
  };
}

/**
 * Fetches CSV text from a URL. Returns null when url is missing/empty.
 * Throws on non-OK HTTP responses.
 */
export async function fetchCsvText(
  url: string | undefined,
): Promise<string | null> {
  if (!url?.trim()) return null;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Catalog CSV fetch failed (${res.status}): ${url}`);
  }
  return res.text();
}
