import { iguazuPdfCopy } from "@/data/pdf-copy/iguazu";
import type { PdfDestinationCopy } from "@/data/pdf-copy/types";
import { provinceToCatalogDestino } from "@/lib/cotizador/provinces";

const BY_CATALOG_DESTINO: Record<string, PdfDestinationCopy> = {
  Iguazú: iguazuPdfCopy,
};

/**
 * Editorial PDF copy by destination.
 * Accepts form selections (provinces) or catalog names; resolves via province map.
 * Only Iguazú has dedicated copy today; others get a generic fallback.
 */
export function getPdfCopy(destino: string): PdfDestinationCopy {
  const catalogKey = provinceToCatalogDestino(destino) ?? destino;
  const known = BY_CATALOG_DESTINO[catalogKey];
  if (known) return known;

  return {
    locationLabel: destino,
    defaultTags: [{ emoji: "✈️", label: destino }],
    guideSubtitle: ({ perfil }) => `${destino} · ${perfil}`,
    excludes: [
      "Vuelos internacionales (si aplican) no incluidos salvo indicación expresa",
      "Ingresos a parques nacionales y atracciones no listadas en inclusiones",
      "Almuerzos, cenas, bebidas, gastos personales",
      "Equipaje despachado si la tarifa aérea no lo incluye",
    ],
    hotelHighlights: [],
    upsells: [],
    tips: [
      {
        emoji: "💡",
        title: "Consultá con tu asesor",
        body: "Tips específicos del destino se completan al cotizar con el equipo Madero.",
      },
    ],
    gastro: [],
    climate: {
      season: "CLIMA",
      range: "Consultar temporada",
      body: "Pedí el detalle climático de tu mes de viaje a tu asesor Madero.",
    },
    packingTitle: `Qué llevar — ${destino}`,
    packing: [
      {
        emoji: "🎒",
        title: "Equipo básico",
        body: "Calzado cómodo, protector solar, documento de viaje y ropa acorde a la temporada.",
      },
    ],
    map: {
      summary: `${destino}. Ubicación y accesos a confirmar con el asesor.`,
      lat: 0,
      lng: 0,
      pinLabel: destino,
    },
  };
}
