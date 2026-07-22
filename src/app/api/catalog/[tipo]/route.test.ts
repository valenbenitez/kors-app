import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  CATALOG_CACHE_CONTROL,
  handleCatalogGet,
} from "@/app/api/catalog/[tipo]/route";
import {
  catalogResponseByTipo,
  climaResponseSchema,
  excursionesResponseSchema,
  gastroResponseSchema,
  heroTagsResponseSchema,
  mapasResponseSchema,
  packingResponseSchema,
  tipsResponseSchema,
} from "@/lib/catalog/schemas";
import { CATALOG_TIPOS } from "@/lib/catalog/types";

const getSession = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getSession: (...args: unknown[]) => getSession(...args),
}));

function catalogRequest(tipo: string, query = ""): Request {
  const qs = query ? `?${query}` : "";
  return new Request(`http://localhost/api/catalog/${tipo}${qs}`, {
    method: "GET",
  });
}

describe("GET /api/catalog/[tipo]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ email: "seller@kors.com", sub: "uid-1" });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("returns 401 when there is no session", async () => {
    getSession.mockResolvedValue(null);
    const res = await handleCatalogGet(
      catalogRequest("tips", "destino=Misiones"),
      "tips",
    );
    expect(res.status).toBe(401);
  });

  test("returns 400 for unknown tipo", async () => {
    const res = await handleCatalogGet(
      catalogRequest("hoteles", "destino=Misiones"),
      "hoteles",
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Unknown catalog tipo/i);
  });

  test("returns 400 when destino is missing", async () => {
    const res = await handleCatalogGet(catalogRequest("tips"), "tips");
    expect(res.status).toBe(400);
  });

  test("returns 400 for excursiones without fechaIda", async () => {
    const res = await handleCatalogGet(
      catalogRequest("excursiones", "destino=Misiones"),
      "excursiones",
    );
    expect(res.status).toBe(400);
  });

  test("sets Cache-Control private max-age=300", async () => {
    const res = await handleCatalogGet(
      catalogRequest("tips", "destino=Misiones"),
      "tips",
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(CATALOG_CACHE_CONTROL);
  });

  test("excursiones filters by destino (Misiones → Iguazú)", async () => {
    const res = await handleCatalogGet(
      catalogRequest("excursiones", "destino=Misiones&fechaIda=2026-08-10"),
      "excursiones",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = excursionesResponseSchema.parse(body);
    expect(parsed.items.length).toBeGreaterThan(0);
    expect(parsed.items.every((e) => e.destino === "Iguazú")).toBe(true);
  });

  test("excursiones returns empty for unmapped province", async () => {
    const res = await handleCatalogGet(
      catalogRequest("excursiones", "destino=Catamarca&fechaIda=2026-08-10"),
      "excursiones",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(excursionesResponseSchema.parse(body).items).toEqual([]);
  });

  test.each(CATALOG_TIPOS)("contract shape for tipo=%s", async (tipo) => {
    const query =
      tipo === "excursiones"
        ? "destino=Misiones&fechaIda=2026-08-10"
        : tipo === "clima"
          ? "destino=Misiones&mes=7"
          : "destino=Misiones";

    const res = await handleCatalogGet(catalogRequest(tipo, query), tipo);
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = catalogResponseByTipo[tipo].safeParse(body);
    expect(parsed.success).toBe(true);
  });

  test("tips / gastro / packing / hero_tags return Iguazú copy for Misiones", async () => {
    const tips = tipsResponseSchema.parse(
      await (
        await handleCatalogGet(
          catalogRequest("tips", "destino=Misiones"),
          "tips",
        )
      ).json(),
    );
    expect(tips.items.length).toBeGreaterThan(0);

    const gastro = gastroResponseSchema.parse(
      await (
        await handleCatalogGet(
          catalogRequest("gastro", "destino=Misiones"),
          "gastro",
        )
      ).json(),
    );
    expect(gastro.items.length).toBeGreaterThan(0);

    const packing = packingResponseSchema.parse(
      await (
        await handleCatalogGet(
          catalogRequest("packing", "destino=Misiones"),
          "packing",
        )
      ).json(),
    );
    expect(packing.items.length).toBeGreaterThan(0);
    expect(packing.title.length).toBeGreaterThan(0);

    const tags = heroTagsResponseSchema.parse(
      await (
        await handleCatalogGet(
          catalogRequest("hero_tags", "destino=Misiones"),
          "hero_tags",
        )
      ).json(),
    );
    expect(tags.items.length).toBeGreaterThan(0);
  });

  test("mapas returns Iguazú map; null for destination without dedicated copy", async () => {
    const iguazu = mapasResponseSchema.parse(
      await (
        await handleCatalogGet(
          catalogRequest("mapas", "destino=Misiones"),
          "mapas",
        )
      ).json(),
    );
    expect(iguazu.item).not.toBeNull();
    expect(iguazu.item?.lat).toBeCloseTo(-25.5985);

    const empty = mapasResponseSchema.parse(
      await (
        await handleCatalogGet(
          catalogRequest("mapas", "destino=Mendoza"),
          "mapas",
        )
      ).json(),
    );
    expect(empty.item).toBeNull();
  });

  test("clima returns climate blob and echoes mes", async () => {
    const body = climaResponseSchema.parse(
      await (
        await handleCatalogGet(
          catalogRequest("clima", "destino=Misiones&mes=7"),
          "clima",
        )
      ).json(),
    );
    expect(body.mes).toBe(7);
    expect(body.item?.season).toBeTruthy();

    const noCopy = climaResponseSchema.parse(
      await (
        await handleCatalogGet(
          catalogRequest("clima", "destino=Mendoza&mes=1"),
          "clima",
        )
      ).json(),
    );
    expect(noCopy.item).toBeNull();
    expect(noCopy.mes).toBe(1);
  });

  test("clima rejects invalid mes", async () => {
    const res = await handleCatalogGet(
      catalogRequest("clima", "destino=Misiones&mes=13"),
      "clima",
    );
    expect(res.status).toBe(400);
  });
});
