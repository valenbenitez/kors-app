import {
  type CatalogExcursion,
  DESTINOS,
  filterExcursions,
} from "@/lib/cotizador/catalog";

/**
 * Argentine provinces + CABA for the destination selector UI.
 * Sorted alphabetically; values are the exact form enum strings.
 */
export const PROVINCIAS_AR = [
  "Buenos Aires",
  "CABA",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
] as const;

/** International options outside Argentine provinces. */
export const DESTINOS_EXTRA = ["Uruguay"] as const;

/** Full list shown in the wizard destination chips (provinces + extras). */
export const DESTINO_OPTIONS = [...PROVINCIAS_AR, ...DESTINOS_EXTRA] as const;

export type DestinoOption = (typeof DESTINO_OPTIONS)[number];

/** Catalog destination keys used by `filterExcursions` (unchanged). */
export const CATALOG_DESTINOS = DESTINOS;

export type CatalogDestino = (typeof CATALOG_DESTINOS)[number];

/**
 * Maps a form selection (province / Uruguay) to a Madero catalog destination.
 * Returns null when the province has no catalog coverage yet.
 */
export function provinceToCatalogDestino(
  selection: string,
): CatalogDestino | null {
  switch (selection) {
    case "Misiones":
      return "Iguazú";
    case "Río Negro":
    case "Neuquén":
      return "Bariloche";
    case "Santa Cruz":
      return "Calafate";
    case "Tierra del Fuego":
      return "Ushuaia";
    case "Salta":
    case "Jujuy":
      return "Salta-Jujuy";
    case "Mendoza":
      return "Mendoza";
    case "Buenos Aires":
    case "CABA":
      return "Buenos Aires";
    case "Uruguay":
      return "Uruguay";
    default:
      return null;
  }
}

/**
 * Filter catalog excursions for a form destination selection.
 * Unmapped provinces yield an empty list (wizard empty state).
 */
export function excursionsForSelection(options: {
  selection: string;
  fechaIda: string;
  query?: string;
}): CatalogExcursion[] {
  const catalogDestino = provinceToCatalogDestino(options.selection);
  if (!catalogDestino) return [];
  return filterExcursions({
    destino: catalogDestino,
    fechaIda: options.fechaIda,
    query: options.query,
  });
}
