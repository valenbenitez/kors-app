import { z } from "zod";
import { CATALOG_TIPOS } from "@/lib/catalog/types";

export const catalogTipoSchema = z.enum(CATALOG_TIPOS);

const politicaMenoresSchema = z.enum([
  "Mismo adulto",
  "Precio especial",
  "No aplica",
  "Consultar",
]);

export const catalogExcursionSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  nombreLimpio: z.string(),
  activa: z.boolean(),
  destino: z.string(),
  moneda: z.enum(["ARS", "USD"]),
  neto: z.number(),
  precioMenor: z.number().nullable(),
  politicaMenores: politicaMenoresSchema,
  proveedor: z.string(),
  observaciones: z.string(),
  notas: z.string(),
  tipo: z.string(),
  validezDesde: z.string().nullable(),
  validezHasta: z.string().nullable(),
  categoriaPaquete: z.string(),
});

export const tipSchema = z.object({
  emoji: z.string(),
  title: z.string(),
  body: z.string(),
});

export const gastroSchema = z.object({
  emoji: z.string(),
  name: z.string(),
  body: z.string(),
  mapsQuery: z.string(),
});

export const packingItemSchema = z.object({
  emoji: z.string(),
  title: z.string(),
  body: z.string(),
});

export const climateSchema = z.object({
  season: z.string(),
  range: z.string(),
  body: z.string(),
});

export const mapSchema = z.object({
  summary: z.string(),
  lat: z.number(),
  lng: z.number(),
  pinLabel: z.string(),
});

export const heroTagSchema = z.object({
  emoji: z.string(),
  label: z.string(),
  accent: z.boolean().optional(),
});

export const excursionesResponseSchema = z.object({
  items: z.array(catalogExcursionSchema),
});

export const tipsResponseSchema = z.object({
  items: z.array(tipSchema),
});

export const gastroResponseSchema = z.object({
  items: z.array(gastroSchema),
});

export const packingResponseSchema = z.object({
  title: z.string(),
  items: z.array(packingItemSchema),
});

export const mapasResponseSchema = z.object({
  item: mapSchema.nullable(),
});

export const climaResponseSchema = z.object({
  item: climateSchema.nullable(),
  mes: z.number().int().min(1).max(12).nullable(),
});

export const heroTagsResponseSchema = z.object({
  items: z.array(heroTagSchema),
});

export const catalogResponseByTipo = {
  excursiones: excursionesResponseSchema,
  tips: tipsResponseSchema,
  gastro: gastroResponseSchema,
  packing: packingResponseSchema,
  mapas: mapasResponseSchema,
  clima: climaResponseSchema,
  hero_tags: heroTagsResponseSchema,
} as const;

/** Query string helpers — route parses and validates before calling the repo. */
export const destinoQuerySchema = z.string().trim().min(1, "destino required");

export const fechaIdaQuerySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "fechaIda must be YYYY-MM-DD");

export const mesQuerySchema = z.coerce.number().int().min(1).max(12);
