# Catálogos runtime

## Estado actual (P2)

**Static fallback** + **Firestore** behind a `CatalogRepository` interface.
Factory: `createCatalogRepository()` (`src/lib/catalog/create-repository.ts`).

| Tipo | Fuente (Firestore post-sync) | Query |
|------|---------------------------|-------|
| `excursiones` | `catalogExcursions/{id}` | `destino` + `fechaIda` (optional `query`) |
| `tips` | `catalogEditorial/{destino}__tips` | `destino` |
| `gastro` | `catalogEditorial/{destino}__gastro` | `destino` |
| `packing` | `catalogEditorial/{destino}__packing` | `destino` |
| `mapas` | `catalogEditorial/{destino}__mapas` | `destino` |
| `clima` | `catalogEditorial/{destino}__clima` | `destino`, optional `mes` |
| `hero_tags` | `catalogEditorial/{destino}__hero_tags` | `destino` |

- **API:** `GET /api/catalog/{tipo}` — session required; `Cache-Control: private, max-age=300`.
  Uses Firestore when synced (or `CATALOG_SOURCE=firestore`); otherwise bundled static.
- **Wizard:** Costos step loads `excursiones` from this API.
- **Formula / PDF build-input:** still resolve excursions from bundled `excursions.json`
  for sync pricing until a follow-up wires async shared resolution. Keep Sheet → sync
  → `GET /api/catalog` as the path that reflects live catalog edits today.

## Sync Sheet ↔ Firestore

### Trigger

```bash
# Manual (admin session cookie) or cron secret:
curl -X POST "$APP_URL/api/admin/sync-catalog" \
  -H "Authorization: Bearer $CATALOG_SYNC_SECRET"
```

Auth (either):

1. `Authorization: Bearer <CATALOG_SYNC_SECRET>` (preferred) or `CRON_SECRET`
2. Logged-in **admin** session (`admin` claim or `ADMIN_EMAILS`)

Optional Vercel Cron (example `vercel.json`):

```json
{
  "crons": [{ "path": "/api/admin/sync-catalog", "schedule": "0 6 * * *" }]
}
```

Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is set.

### Env vars

| Variable | Role |
|----------|------|
| `CATALOG_EXCURSIONS_SHEET_URL` | Published Google Sheet CSV export (excursions). Source of truth when set. |
| `CATALOG_COPY_SHEET_URL` | Published Google Sheet CSV export (editorial). Source of truth when set. |
| `CATALOG_SYNC_SECRET` | Bearer token for sync endpoint (falls back to `CRON_SECRET`). |
| `CRON_SECRET` | Alternate sync bearer (Vercel Cron). |
| `CATALOG_SOURCE` | `static` \| `firestore` \| unset(`auto`). Auto uses Firestore when `catalogMeta/sync` exists. |

When **both** sheet URLs are unset, sync **seeds from bundled static** data
(`excursions.json` + Iguazú PDF copy) so local/dev can demo Firestore reads.

### Sheet column contracts

**Excursions CSV** (`CATALOG_EXCURSIONS_SHEET_URL`) — one row per excursion:

```
id,nombre,activa,destino,moneda,neto,precioMenor,politicaMenores,proveedor,observaciones,notas,tipo,validezDesde,validezHasta,categoriaPaquete
```

- `activa`: `true`/`false` (also `1`/`0`, `yes`/`no`)
- `precioMenor`, `validezDesde`, `validezHasta`: empty or `null` → null
- `nombreLimpio` optional; derived from `nombre` when omitted
- Doc id = `id` → re-sync overwrites (idempotent)

**Editorial CSV** (`CATALOG_COPY_SHEET_URL`):

```
destino,tipo,payload
```

- `tipo` ∈ `tips` \| `gastro` \| `packing` \| `mapas` \| `clima` \| `hero_tags`
- `payload`: JSON string
  - tips / gastro / hero_tags → array of objects
  - packing → `{ "title": string, "items": [...] }`
  - mapas / clima → object or `null`
- Doc id = `{destino}__{tipo}` → idempotent upsert

### Idempotency & errors

- Upserts use `set(..., { merge: true })` with stable document ids → **re-run does not duplicate**.
- Invalid rows are Zod-validated **per row**; sync continues and returns
  `{ written, errors: [{ source, row, error }] }` (HTTP 200 if anything wrote;
  422 if zero writes and errors remain).
- Sync writes `catalogMeta/sync` so the factory can switch to Firestore.

### Out of scope

- Inline edit of catalog rows in the app
- Admin CRUD UI
