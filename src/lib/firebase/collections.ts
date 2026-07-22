/** Firestore collection names. */
export const TRIP_QUOTES = "tripQuotes" as const;

/** Catalog excursions synced from Sheet/static (`catalogExcursions/{id}`). */
export const CATALOG_EXCURSIONS = "catalogExcursions" as const;

/**
 * Editorial catalog blobs (`catalogEditorial/{destino}__{tipo}`).
 * `tipo` ∈ tips | gastro | packing | mapas | clima | hero_tags.
 */
export const CATALOG_EDITORIAL = "catalogEditorial" as const;

/** Sync metadata singleton (`catalogMeta/sync`). */
export const CATALOG_META = "catalogMeta" as const;
export const CATALOG_META_SYNC_DOC = "sync" as const;

/** Counter documents (`counters/{id}`). */
export const COUNTERS = "counters" as const;
export const COUNTER_TRIP_QUOTES = "tripQuotes" as const;
