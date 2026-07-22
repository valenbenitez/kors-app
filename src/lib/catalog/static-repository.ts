import { getPdfCopy } from "@/data/pdf-copy";
import type { CatalogRepository } from "@/lib/catalog/repository";
import type {
  CatalogQuery,
  CatalogResponse,
  CatalogTipo,
} from "@/lib/catalog/types";
import { filterExcursions } from "@/lib/cotizador/catalog";
import { provinceToCatalogDestino } from "@/lib/cotizador/provinces";

/**
 * Static-first catalog: excursions from bundled JSON via `filterExcursions`;
 * tips / gastro / packing / mapas / clima / hero_tags from `getPdfCopy`.
 *
 * Firestore-backed repo + admin sync is P2 — see docs/catalog.md.
 */
export class StaticCatalogRepository implements CatalogRepository {
  async get(tipo: CatalogTipo, query: CatalogQuery): Promise<CatalogResponse> {
    switch (tipo) {
      case "excursiones":
        return this.excursiones(query);
      case "tips":
        return this.tips(query);
      case "gastro":
        return this.gastro(query);
      case "packing":
        return this.packing(query);
      case "mapas":
        return this.mapas(query);
      case "clima":
        return this.clima(query);
      case "hero_tags":
        return this.heroTags(query);
    }
  }

  private requireDestino(query: CatalogQuery): string {
    const destino = query.destino?.trim();
    if (!destino) {
      throw new CatalogQueryError("destino is required");
    }
    return destino;
  }

  private resolveCatalogKey(selection: string): string {
    return provinceToCatalogDestino(selection) ?? selection;
  }

  private excursiones(query: CatalogQuery): CatalogResponse {
    const destino = this.requireDestino(query);
    const fechaIda = query.fechaIda?.trim();
    if (!fechaIda) {
      throw new CatalogQueryError("fechaIda is required for excursiones");
    }

    const catalogDestino = provinceToCatalogDestino(destino);
    if (!catalogDestino) {
      return { items: [] };
    }

    return {
      items: filterExcursions({
        destino: catalogDestino,
        fechaIda,
        query: query.query,
      }),
    };
  }

  private tips(query: CatalogQuery): CatalogResponse {
    const copy = getPdfCopy(this.requireDestino(query));
    return { items: copy.tips };
  }

  private gastro(query: CatalogQuery): CatalogResponse {
    const copy = getPdfCopy(this.requireDestino(query));
    return { items: copy.gastro };
  }

  private packing(query: CatalogQuery): CatalogResponse {
    const copy = getPdfCopy(this.requireDestino(query));
    return { title: copy.packingTitle, items: copy.packing };
  }

  private mapas(query: CatalogQuery): CatalogResponse {
    const destino = this.requireDestino(query);
    if (!hasDedicatedPdfCopy(this.resolveCatalogKey(destino))) {
      return { item: null };
    }
    return { item: getPdfCopy(destino).map };
  }

  private clima(query: CatalogQuery): CatalogResponse {
    const destino = this.requireDestino(query);
    const mes = query.mes ?? null;

    if (!hasDedicatedPdfCopy(this.resolveCatalogKey(destino))) {
      return { item: null, mes };
    }

    // Multi-month climate tables are not in static copy yet; ?mes= is echoed
    // for clients and will drive season selection once P2 data lands.
    return { item: getPdfCopy(destino).climate, mes };
  }

  private heroTags(query: CatalogQuery): CatalogResponse {
    const copy = getPdfCopy(this.requireDestino(query));
    return { items: copy.defaultTags };
  }
}

/** Destinations with dedicated editorial modules under `src/data/pdf-copy/`. */
const DEDICATED_PDF_DESTINOS = new Set(["Iguazú"]);

function hasDedicatedPdfCopy(catalogOrSelection: string): boolean {
  const key =
    provinceToCatalogDestino(catalogOrSelection) ?? catalogOrSelection;
  return DEDICATED_PDF_DESTINOS.has(key);
}

export class CatalogQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogQueryError";
  }
}
