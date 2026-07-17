import excursionsData from "@/data/excursions.json";
import { cleanExcursionTitle } from "@/lib/cotizador/clean-title";
import type { PoliticaMenores } from "@/lib/cotizador/formula";

export type CatalogExcursion = {
  id: string;
  nombre: string;
  nombreLimpio: string;
  activa: boolean;
  destino: string;
  moneda: "ARS" | "USD";
  neto: number;
  precioMenor: number | null;
  politicaMenores: PoliticaMenores;
  proveedor: string;
  observaciones: string;
  notas: string;
  tipo: string;
  validezDesde: string | null;
  validezHasta: string | null;
  categoriaPaquete: string;
};

const POLITICAS = new Set<PoliticaMenores>([
  "Mismo adulto",
  "Precio especial",
  "No aplica",
  "Consultar",
]);

function normalizePolitica(raw: string): PoliticaMenores {
  if (POLITICAS.has(raw as PoliticaMenores)) {
    return raw as PoliticaMenores;
  }
  return "Mismo adulto";
}

export const DESTINOS = [
  "Iguazú",
  "Bariloche",
  "Calafate",
  "Ushuaia",
  "Salta-Jujuy",
  "Mendoza",
  "Buenos Aires",
  "Uruguay",
] as const;

export type Destino = (typeof DESTINOS)[number];

export const catalog: CatalogExcursion[] = (
  excursionsData as Array<{
    id: string;
    nombre: string;
    activa: boolean;
    destino: string;
    moneda: string;
    neto: number;
    precioMenor: number | null;
    politicaMenores: string;
    proveedor: string;
    observaciones: string;
    notas: string;
    tipo: string;
    validezDesde: string | null;
    validezHasta: string | null;
    categoriaPaquete: string;
  }>
).map((row) => ({
  ...row,
  moneda: row.moneda === "USD" ? "USD" : "ARS",
  politicaMenores: normalizePolitica(row.politicaMenores),
  nombreLimpio: cleanExcursionTitle(row.nombre),
}));

function inValidityWindow(
  tripStart: string,
  desde: string | null,
  hasta: string | null,
): boolean {
  if (desde && tripStart < desde) return false;
  if (hasta && tripStart > hasta) return false;
  return true;
}

/** Filtra catálogo por destino + activa + vigencia respecto a fecha de ida. */
export function filterExcursions(options: {
  destino: string;
  fechaIda: string;
}): CatalogExcursion[] {
  const { destino, fechaIda } = options;
  return catalog.filter(
    (exc) =>
      exc.activa &&
      exc.destino === destino &&
      inValidityWindow(fechaIda, exc.validezDesde, exc.validezHasta),
  );
}
