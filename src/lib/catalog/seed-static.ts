import { getPdfCopy } from "@/data/pdf-copy";
import type { EditorialDoc } from "@/lib/catalog/parse-editorial";
import type { CatalogExcursion } from "@/lib/cotizador/catalog";
import { catalog } from "@/lib/cotizador/catalog";

/** Destinations with dedicated editorial modules under `src/data/pdf-copy/`. */
const DEDICATED_PDF_DESTINOS = ["Iguazú"] as const;

/**
 * Builds excursion + editorial docs from bundled static data for local/dev seed
 * when Sheet CSV URLs are not configured.
 */
export function buildStaticSeedPayload(): {
  excursions: CatalogExcursion[];
  editorial: EditorialDoc[];
} {
  const excursions = [...catalog];
  const editorial: EditorialDoc[] = [];

  for (const destino of DEDICATED_PDF_DESTINOS) {
    const copy = getPdfCopy(destino);
    editorial.push(
      { destino, tipo: "tips", payload: copy.tips },
      { destino, tipo: "gastro", payload: copy.gastro },
      {
        destino,
        tipo: "packing",
        payload: { title: copy.packingTitle, items: copy.packing },
      },
      { destino, tipo: "mapas", payload: copy.map },
      { destino, tipo: "clima", payload: copy.climate },
      { destino, tipo: "hero_tags", payload: copy.defaultTags },
    );
  }

  return { excursions, editorial };
}
