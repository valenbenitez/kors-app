import type {
  CatalogQuery,
  CatalogResponse,
  CatalogTipo,
} from "@/lib/catalog/types";

/**
 * Catalog read port.
 * Implementations: {@link StaticCatalogRepository}, {@link FirestoreCatalogRepository}.
 * Factory: {@link createCatalogRepository}.
 */
export interface CatalogRepository {
  get(tipo: CatalogTipo, query: CatalogQuery): Promise<CatalogResponse>;
}
