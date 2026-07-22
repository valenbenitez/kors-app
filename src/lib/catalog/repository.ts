import type {
  CatalogQuery,
  CatalogResponse,
  CatalogTipo,
} from "@/lib/catalog/types";

/**
 * Catalog read port. MVP uses {@link StaticCatalogRepository}; a Firestore
 * implementation lands with P2 sync (no seed in this PR).
 */
export interface CatalogRepository {
  get(tipo: CatalogTipo, query: CatalogQuery): Promise<CatalogResponse>;
}
