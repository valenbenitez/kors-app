import type { CatalogExcursion } from "@/lib/cotizador/catalog";

export const CATALOG_TIPOS = [
  "excursiones",
  "mapas",
  "tips",
  "gastro",
  "clima",
  "hero_tags",
  "packing",
] as const;

export type CatalogTipo = (typeof CATALOG_TIPOS)[number];

export function isCatalogTipo(value: string): value is CatalogTipo {
  return (CATALOG_TIPOS as readonly string[]).includes(value);
}

export type CatalogTip = {
  emoji: string;
  title: string;
  body: string;
};

export type CatalogGastro = {
  emoji: string;
  name: string;
  body: string;
  mapsQuery: string;
};

export type CatalogPackingItem = {
  emoji: string;
  title: string;
  body: string;
};

export type CatalogClimate = {
  season: string;
  range: string;
  body: string;
};

export type CatalogMap = {
  summary: string;
  lat: number;
  lng: number;
  pinLabel: string;
};

export type CatalogHeroTag = {
  emoji: string;
  label: string;
  accent?: boolean;
};

export type ExcursionesCatalogResponse = {
  items: CatalogExcursion[];
};

export type TipsCatalogResponse = {
  items: CatalogTip[];
};

export type GastroCatalogResponse = {
  items: CatalogGastro[];
};

export type PackingCatalogResponse = {
  title: string;
  items: CatalogPackingItem[];
};

export type MapasCatalogResponse = {
  item: CatalogMap | null;
};

export type ClimaCatalogResponse = {
  item: CatalogClimate | null;
  /** Echo of ?mes= when provided (1–12). Season mapping lands with multi-month copy. */
  mes: number | null;
};

export type HeroTagsCatalogResponse = {
  items: CatalogHeroTag[];
};

export type CatalogResponse =
  | ExcursionesCatalogResponse
  | TipsCatalogResponse
  | GastroCatalogResponse
  | PackingCatalogResponse
  | MapasCatalogResponse
  | ClimaCatalogResponse
  | HeroTagsCatalogResponse;

export type CatalogQuery = {
  destino?: string;
  fechaIda?: string;
  mes?: number;
  query?: string;
};
