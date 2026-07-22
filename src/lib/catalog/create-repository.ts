import { FirestoreCatalogRepository } from "@/lib/catalog/firestore-repository";
import { hasCatalogSyncedData } from "@/lib/catalog/firestore-writer";
import type { CatalogRepository } from "@/lib/catalog/repository";
import { StaticCatalogRepository } from "@/lib/catalog/static-repository";

export type CatalogSourceMode = "static" | "firestore" | "auto";

function resolveCatalogSourceEnv(): CatalogSourceMode {
  const raw = process.env.CATALOG_SOURCE?.trim().toLowerCase();
  if (raw === "static" || raw === "firestore") return raw;
  return "auto";
}

/**
 * Picks the catalog repository:
 * - `CATALOG_SOURCE=static` → always bundled static
 * - `CATALOG_SOURCE=firestore` → always Firestore (must be synced)
 * - unset / `auto` → Firestore when `catalogMeta/sync` exists, else static
 *
 * Formula/`build-input` still reads bundled `excursions.json` until a follow-up
 * wires shared async resolution; `GET /api/catalog` uses this factory.
 */
export async function createCatalogRepository(): Promise<CatalogRepository> {
  const mode = resolveCatalogSourceEnv();

  if (mode === "static") {
    return new StaticCatalogRepository();
  }

  if (mode === "firestore") {
    return new FirestoreCatalogRepository();
  }

  try {
    if (await hasCatalogSyncedData()) {
      return new FirestoreCatalogRepository();
    }
  } catch {
    // Firestore unavailable (missing creds / emulator off) → static fallback
  }

  return new StaticCatalogRepository();
}
