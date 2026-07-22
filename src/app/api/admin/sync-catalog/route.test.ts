import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { handleSyncCatalogPost } from "@/app/api/admin/sync-catalog/route";
import type { CatalogSyncSummary } from "@/lib/catalog/sync-types";

const getSession = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getSession: (...args: unknown[]) => getSession(...args),
}));

function syncRequest(init?: RequestInit): Request {
  return new Request("http://localhost/api/admin/sync-catalog", {
    method: "POST",
    ...init,
  });
}

const okSummary: CatalogSyncSummary = {
  source: "sheet",
  excursions: { written: 2, errors: [] },
  editorial: {
    written: 1,
    errors: [{ source: "editorial", row: 3, error: "bad payload" }],
  },
  written: 3,
  errors: [{ source: "editorial", row: 3, error: "bad payload" }],
};

describe("POST /api/admin/sync-catalog", () => {
  const prevSyncSecret = process.env.CATALOG_SYNC_SECRET;
  const prevCronSecret = process.env.CRON_SECRET;
  const prevAdminEmails = process.env.ADMIN_EMAILS;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CATALOG_SYNC_SECRET;
    delete process.env.CRON_SECRET;
    delete process.env.ADMIN_EMAILS;
    getSession.mockResolvedValue(null);
  });

  afterEach(() => {
    if (prevSyncSecret === undefined) {
      delete process.env.CATALOG_SYNC_SECRET;
    } else {
      process.env.CATALOG_SYNC_SECRET = prevSyncSecret;
    }
    if (prevCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = prevCronSecret;
    }
    if (prevAdminEmails === undefined) {
      delete process.env.ADMIN_EMAILS;
    } else {
      process.env.ADMIN_EMAILS = prevAdminEmails;
    }
  });

  test("returns 401 without admin session or sync secret", async () => {
    const res = await handleSyncCatalogPost(syncRequest());
    expect(res.status).toBe(401);
  });

  test("allows Bearer CATALOG_SYNC_SECRET and reports partial errors", async () => {
    process.env.CATALOG_SYNC_SECRET = "sync-secret";
    const sync = vi.fn(async () => okSummary);
    const createWriter = vi.fn(() => ({
      upsertExcursion: vi.fn(),
      upsertEditorial: vi.fn(),
      markSynced: vi.fn(),
    }));

    const res = await handleSyncCatalogPost(
      syncRequest({
        headers: { Authorization: "Bearer sync-secret" },
      }),
      {
        sync,
        createWriter: createWriter as never,
        fetchExcursionsCsv: async () => "csv",
        fetchEditorialCsv: async () => "csv",
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.written).toBe(3);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].row).toBe(3);
    expect(sync).toHaveBeenCalledOnce();
  });

  test("allows admin session via ADMIN_EMAILS", async () => {
    process.env.ADMIN_EMAILS = "boss@kors.com";
    getSession.mockResolvedValue({
      email: "boss@kors.com",
      sub: "admin-1",
    });

    const sync = vi.fn(async () => ({
      ...okSummary,
      errors: [],
      editorial: { written: 1, errors: [] },
    }));

    const res = await handleSyncCatalogPost(syncRequest(), {
      sync,
      createWriter: () =>
        ({
          upsertExcursion: vi.fn(),
          upsertEditorial: vi.fn(),
          markSynced: vi.fn(),
        }) as never,
      fetchExcursionsCsv: async () => null,
      fetchEditorialCsv: async () => null,
    });

    expect(res.status).toBe(200);
    expect(sync).toHaveBeenCalledOnce();
  });

  test("returns 422 when every row fails", async () => {
    process.env.CATALOG_SYNC_SECRET = "x";
    const sync = vi.fn(
      async (): Promise<CatalogSyncSummary> => ({
        source: "sheet",
        excursions: {
          written: 0,
          errors: [{ source: "excursions", row: 2, error: "bad" }],
        },
        editorial: { written: 0, errors: [] },
        written: 0,
        errors: [{ source: "excursions", row: 2, error: "bad" }],
      }),
    );

    const res = await handleSyncCatalogPost(
      syncRequest({ headers: { Authorization: "Bearer x" } }),
      {
        sync,
        createWriter: () =>
          ({
            upsertExcursion: vi.fn(),
            upsertEditorial: vi.fn(),
            markSynced: vi.fn(),
          }) as never,
        fetchExcursionsCsv: async () => "csv",
        fetchEditorialCsv: async () => null,
      },
    );

    expect(res.status).toBe(422);
  });
});
