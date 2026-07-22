import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createFirestoreCatalogSyncWriter } from "@/lib/catalog/firestore-writer";
import { fetchCsvText, syncCatalog } from "@/lib/catalog/sync-catalog";
import type { CatalogSyncSummary } from "@/lib/catalog/sync-types";
import { isAdmin } from "@/lib/firebase/trip-quotes/access";

export const runtime = "nodejs";

/** Max duration hint for Vercel (sync can write many docs). */
export const maxDuration = 60;

export type SyncCatalogRouteDeps = {
  sync?: typeof syncCatalog;
  fetchExcursionsCsv?: () => Promise<string | null>;
  fetchEditorialCsv?: () => Promise<string | null>;
  createWriter?: typeof createFirestoreCatalogSyncWriter;
};

/**
 * POST /api/admin/sync-catalog
 *
 * Auth: admin session OR `Authorization: Bearer <CATALOG_SYNC_SECRET|CRON_SECRET>`.
 * Sources: Sheet CSV URLs when set; otherwise seeds from bundled static data.
 */
export async function POST(request: Request) {
  return handleSyncCatalogPost(request);
}

export async function handleSyncCatalogPost(
  request: Request,
  deps: SyncCatalogRouteDeps = {},
): Promise<NextResponse> {
  const authorized = await authorizeSyncRequest(request);
  if (!authorized) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const fetchExcursions =
      deps.fetchExcursionsCsv ??
      (() => fetchCsvText(process.env.CATALOG_EXCURSIONS_SHEET_URL));
    const fetchEditorial =
      deps.fetchEditorialCsv ??
      (() => fetchCsvText(process.env.CATALOG_COPY_SHEET_URL));

    const [excursionsCsv, editorialCsv] = await Promise.all([
      fetchExcursions(),
      fetchEditorial(),
    ]);

    const writer = (deps.createWriter ?? createFirestoreCatalogSyncWriter)();
    const runSync = deps.sync ?? syncCatalog;

    const summary: CatalogSyncSummary = await runSync(
      {
        excursionsCsv,
        editorialCsv,
        allowStaticSeed: true,
      },
      writer,
    );

    const status =
      summary.errors.length > 0 && summary.written === 0 ? 422 : 200;
    return NextResponse.json(summary, { status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Catalog sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function authorizeSyncRequest(request: Request): Promise<boolean> {
  const secret = resolveSyncSecret();
  if (secret) {
    const header = request.headers.get("authorization");
    if (header === `Bearer ${secret}`) {
      return true;
    }
  }

  const session = await getSession();
  if (session && isAdmin(session)) {
    return true;
  }

  return false;
}

function resolveSyncSecret(): string | null {
  const catalog = process.env.CATALOG_SYNC_SECRET?.trim();
  if (catalog) return catalog;
  const cron = process.env.CRON_SECRET?.trim();
  if (cron) return cron;
  return null;
}
