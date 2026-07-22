import { FieldValue } from "firebase-admin/firestore";
import {
  type EditorialDoc,
  editorialDocId,
} from "@/lib/catalog/parse-editorial";
import type { CatalogSyncWriter } from "@/lib/catalog/sync-types";
import type { CatalogExcursion } from "@/lib/cotizador/catalog";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  CATALOG_EDITORIAL,
  CATALOG_EXCURSIONS,
  CATALOG_META,
  CATALOG_META_SYNC_DOC,
} from "@/lib/firebase/collections";

/**
 * Firestore upsert writer: doc id = entity id → re-runs overwrite, never duplicate.
 */
export function createFirestoreCatalogSyncWriter(): CatalogSyncWriter {
  const db = getAdminFirestore();

  return {
    async upsertExcursion(excursion: CatalogExcursion) {
      await db
        .collection(CATALOG_EXCURSIONS)
        .doc(excursion.id)
        .set(
          {
            ...excursion,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
    },

    async upsertEditorial(doc: EditorialDoc) {
      const id = editorialDocId(doc.destino, doc.tipo);
      await db.collection(CATALOG_EDITORIAL).doc(id).set(
        {
          destino: doc.destino,
          tipo: doc.tipo,
          payload: doc.payload,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    },

    async markSynced(meta) {
      await db.collection(CATALOG_META).doc(CATALOG_META_SYNC_DOC).set(
        {
          lastSyncedAt: FieldValue.serverTimestamp(),
          source: meta.source,
          written: meta.written,
          errorCount: meta.errorCount,
        },
        { merge: true },
      );
    },
  };
}

/** True when a prior successful sync wrote the meta doc. */
export async function hasCatalogSyncedData(): Promise<boolean> {
  const snap = await getAdminFirestore()
    .collection(CATALOG_META)
    .doc(CATALOG_META_SYNC_DOC)
    .get();
  return snap.exists;
}
