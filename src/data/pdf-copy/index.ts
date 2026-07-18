import { iguazuPdfCopy } from "@/data/pdf-copy/iguazu";
import type { PdfDestinationCopy } from "@/data/pdf-copy/types";

const BY_DESTINO: Record<string, PdfDestinationCopy> = {
  Iguazú: iguazuPdfCopy,
};

/** Copy editorial por destino. Hoy solo Iguazú; otros destinos → fallback genérico (sin inventar Iguazú). */
export function getPdfCopy(destino: string): PdfDestinationCopy {
  const known = BY_DESTINO[destino];
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
