import { z } from "zod";
import { catalogExcursionSchema } from "@/lib/catalog/schemas";
import type { CatalogExcursion } from "@/lib/cotizador/catalog";
import { cleanExcursionTitle } from "@/lib/cotizador/clean-title";

const csvBooleanSchema = z
  .string()
  .transform((v) => v.trim().toLowerCase())
  .pipe(z.enum(["true", "false", "1", "0", "yes", "no"]))
  .transform((v) => v === "true" || v === "1" || v === "yes");

const csvNullableString = z.string().transform((v) => {
  const t = v.trim();
  if (t === "" || t.toLowerCase() === "null") return null;
  return t;
});

const csvNullableNumber = z.string().transform((v) => {
  const t = v.trim();
  if (t === "" || t.toLowerCase() === "null") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid number: ${t}`);
  }
  return n;
});

const csvNumber = z.string().transform((v) => {
  const n = Number(v.trim());
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid number: ${v}`);
  }
  return n;
});

/**
 * Sheet CSV row → CatalogExcursion.
 * Column contract (header names):
 * id,nombre,activa,destino,moneda,neto,precioMenor,politicaMenores,
 * proveedor,observaciones,notas,tipo,validezDesde,validezHasta,categoriaPaquete
 *
 * `nombreLimpio` is derived from `nombre` when omitted.
 */
const excursionCsvRowSchema = z
  .object({
    id: z.string().trim().min(1),
    nombre: z.string().trim().min(1),
    nombreLimpio: z.string().optional(),
    activa: csvBooleanSchema,
    destino: z.string().trim().min(1),
    moneda: z
      .string()
      .trim()
      .pipe(z.enum(["ARS", "USD"])),
    neto: csvNumber,
    precioMenor: csvNullableNumber,
    politicaMenores: z
      .string()
      .trim()
      .pipe(
        z.enum(["Mismo adulto", "Precio especial", "No aplica", "Consultar"]),
      ),
    proveedor: z.string(),
    observaciones: z.string(),
    notas: z.string(),
    tipo: z.string(),
    validezDesde: csvNullableString,
    validezHasta: csvNullableString,
    categoriaPaquete: z.string(),
  })
  .transform((row): CatalogExcursion => {
    const nombreLimpio =
      row.nombreLimpio?.trim() || cleanExcursionTitle(row.nombre);
    return catalogExcursionSchema.parse({
      ...row,
      nombreLimpio,
    });
  });

export type ExcursionRowParseResult =
  | { ok: true; value: CatalogExcursion; row: number }
  | { ok: false; row: number; error: string };

/**
 * Validates raw CSV row maps into CatalogExcursion values.
 * Continues past invalid rows; returns per-row results.
 */
export function parseExcursionCsvRows(
  rows: Array<Record<string, string>>,
  rowOffset = 2,
): ExcursionRowParseResult[] {
  return rows.map((raw, index) => {
    const row = rowOffset + index;
    const parsed = excursionCsvRowSchema.safeParse(raw);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `${i.path.join(".") || "row"}: ${i.message}`)
        .join("; ");
      return { ok: false as const, row, error: detail };
    }
    return { ok: true as const, value: parsed.data, row };
  });
}
