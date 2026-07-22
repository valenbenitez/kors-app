import { z } from "zod";
import {
  climateSchema,
  gastroSchema,
  heroTagSchema,
  mapSchema,
  packingItemSchema,
  tipSchema,
} from "@/lib/catalog/schemas";

export const EDITORIAL_TIPOS = [
  "tips",
  "gastro",
  "packing",
  "mapas",
  "clima",
  "hero_tags",
] as const;

export type EditorialTipo = (typeof EDITORIAL_TIPOS)[number];

export function isEditorialTipo(value: string): value is EditorialTipo {
  return (EDITORIAL_TIPOS as readonly string[]).includes(value);
}

/** Firestore document id for an editorial blob. */
export function editorialDocId(destino: string, tipo: EditorialTipo): string {
  return `${destino}__${tipo}`;
}

export type EditorialDoc = {
  destino: string;
  tipo: EditorialTipo;
  /** Response payload shape for the tipo (minus clima.mes echo). */
  payload: unknown;
  updatedAt?: Date;
};

const packingPayloadSchema = z.object({
  title: z.string().min(1),
  items: z.array(packingItemSchema),
});

const payloadSchemaByTipo = {
  tips: z.array(tipSchema),
  gastro: z.array(gastroSchema),
  packing: packingPayloadSchema,
  mapas: mapSchema.nullable(),
  clima: climateSchema.nullable(),
  hero_tags: z.array(heroTagSchema),
} as const;

/**
 * Editorial Sheet CSV columns:
 *   destino,tipo,payload
 *
 * `tipo` ∈ tips|gastro|packing|mapas|clima|hero_tags
 * `payload` is a JSON string:
 *   - tips / gastro / hero_tags → JSON array
 *   - packing → `{ "title": string, "items": [...] }`
 *   - mapas / clima → object or `null`
 */
const editorialCsvRowSchema = z
  .object({
    destino: z.string().trim().min(1),
    tipo: z.enum(EDITORIAL_TIPOS),
    payload: z.string().trim().min(1),
  })
  .superRefine((row, ctx) => {
    let json: unknown;
    try {
      json = JSON.parse(row.payload);
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "payload must be valid JSON",
        path: ["payload"],
      });
      return;
    }
    const schema = payloadSchemaByTipo[row.tipo];
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      ctx.addIssue({
        code: "custom",
        message: parsed.error.issues
          .map((i) => `${i.path.join(".") || "payload"}: ${i.message}`)
          .join("; "),
        path: ["payload"],
      });
    }
  })
  .transform((row): EditorialDoc => {
    const json = JSON.parse(row.payload) as unknown;
    const payload = payloadSchemaByTipo[row.tipo].parse(json);
    return {
      destino: row.destino,
      tipo: row.tipo,
      payload,
    };
  });

export type EditorialRowParseResult =
  | { ok: true; value: EditorialDoc; row: number }
  | { ok: false; row: number; error: string };

export function parseEditorialCsvRows(
  rows: Array<Record<string, string>>,
  rowOffset = 2,
): EditorialRowParseResult[] {
  return rows.map((raw, index) => {
    const row = rowOffset + index;
    const parsed = editorialCsvRowSchema.safeParse(raw);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `${i.path.join(".") || "row"}: ${i.message}`)
        .join("; ");
      return { ok: false as const, row, error: detail };
    }
    return { ok: true as const, value: parsed.data, row };
  });
}

export { payloadSchemaByTipo };
