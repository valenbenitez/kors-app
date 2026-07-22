import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import type { CatalogRepository } from "@/lib/catalog/repository";
import {
  catalogResponseByTipo,
  destinoQuerySchema,
  fechaIdaQuerySchema,
  mesQuerySchema,
} from "@/lib/catalog/schemas";
import {
  CatalogQueryError,
  StaticCatalogRepository,
} from "@/lib/catalog/static-repository";
import {
  type CatalogQuery,
  type CatalogTipo,
  isCatalogTipo,
} from "@/lib/catalog/types";

export const runtime = "nodejs";

/** Browser / CDN-friendly TTL; private because the route requires a session. */
export const CATALOG_CACHE_CONTROL = "private, max-age=300";

export type CatalogRouteDeps = {
  repository?: CatalogRepository;
};

type RouteContext = {
  params: Promise<{ tipo: string }>;
};

/** Next.js App Router entry. */
export async function GET(request: Request, context: RouteContext) {
  const { tipo } = await context.params;
  return handleCatalogGet(request, tipo);
}

/**
 * GET /api/catalog/{tipo}
 *
 * `tipo` ∈ {excursiones,mapas,tips,gastro,clima,hero_tags,packing}
 * Query: `?destino=` and/or `?mes=` / `?fechaIda=` as required per tipo.
 * Auth: session required (seller-only app).
 * Cache: `Cache-Control: private, max-age=300`
 */
export async function handleCatalogGet(
  request: Request,
  tipoParam: string,
  deps: CatalogRouteDeps = {},
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!isCatalogTipo(tipoParam)) {
    return NextResponse.json(
      { error: `Unknown catalog tipo: ${tipoParam}` },
      { status: 400 },
    );
  }

  const tipo: CatalogTipo = tipoParam;
  const url = new URL(request.url);
  const queryResult = parseCatalogQuery(tipo, url.searchParams);
  if (!queryResult.ok) {
    return NextResponse.json({ error: queryResult.error }, { status: 400 });
  }

  const repository = deps.repository ?? new StaticCatalogRepository();

  try {
    const payload = await repository.get(tipo, queryResult.query);
    const parsed = catalogResponseByTipo[tipo].safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid catalog payload" },
        { status: 500 },
      );
    }

    return NextResponse.json(parsed.data, {
      status: 200,
      headers: { "Cache-Control": CATALOG_CACHE_CONTROL },
    });
  } catch (error) {
    if (error instanceof CatalogQueryError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

type ParseResult =
  | { ok: true; query: CatalogQuery }
  | { ok: false; error: string };

function parseCatalogQuery(
  tipo: CatalogTipo,
  params: URLSearchParams,
): ParseResult {
  const destinoRaw = params.get("destino");
  const fechaIdaRaw = params.get("fechaIda");
  const mesRaw = params.get("mes");
  const nameQuery = params.get("query") ?? undefined;

  const destino = destinoQuerySchema.safeParse(destinoRaw ?? "");
  if (!destino.success) {
    return { ok: false, error: "Parámetro destino inválido o ausente" };
  }

  if (tipo === "excursiones") {
    const fechaIda = fechaIdaQuerySchema.safeParse(fechaIdaRaw ?? "");
    if (!fechaIda.success) {
      return {
        ok: false,
        error: "Parámetro fechaIda inválido o ausente (YYYY-MM-DD)",
      };
    }
    return {
      ok: true,
      query: {
        destino: destino.data,
        fechaIda: fechaIda.data,
        query: nameQuery ?? undefined,
      },
    };
  }

  if (tipo === "clima") {
    let mes: number | undefined;
    if (mesRaw !== null && mesRaw !== "") {
      const parsedMes = mesQuerySchema.safeParse(mesRaw);
      if (!parsedMes.success) {
        return { ok: false, error: "Parámetro mes inválido (1–12)" };
      }
      mes = parsedMes.data;
    }
    return { ok: true, query: { destino: destino.data, mes } };
  }

  return { ok: true, query: { destino: destino.data } };
}
