# Catálogos runtime

## Estado actual (MVP / P1)

**Static-first** behind a `CatalogRepository` interface.

| Tipo | Fuente | Query |
|------|--------|-------|
| `excursiones` | Bundled `excursions.json` via `filterExcursions` | `destino` + `fechaIda` (optional `query`) |
| `tips` | `getPdfCopy(destino).tips` | `destino` |
| `gastro` | `getPdfCopy(destino).gastro` | `destino` |
| `packing` | `getPdfCopy` packing title + items | `destino` |
| `mapas` | Dedicated PDF copy map, else `null` | `destino` |
| `clima` | Dedicated PDF climate blob; `?mes=` echoed (1–12) | `destino`, optional `mes` |
| `hero_tags` | `getPdfCopy(destino).defaultTags` | `destino` |

- **API:** `GET /api/catalog/{tipo}` — session required; `Cache-Control: private, max-age=300`.
- **Wizard:** Costos step loads `excursiones` from this API (not client-bundled JSON as the sole path). Formula/`build-input` still resolves excursions server-side from the shared catalog module for consistency.
- **PDF:** empty sections stay omitted; wiring `getPdfCopy` via this API is optional and not required yet.

## P2 (out of scope here)

- Firestore repository implementation + seed/sync from static data
- Admin CRUD
- CSV→TS mass import
- Month→season climate tables beyond the single static climate blob
