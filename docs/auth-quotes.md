# Auth policy — trip quotes (cotizaciones)

Server-side read access for persisted trip quotes. Client Firestore rules remain
**deny-all**; only the Admin SDK (API routes) can read/write.

## Policy

| Actor | `GET /api/cotizaciones` | `GET /api/cotizaciones/[id]` |
|-------|-------------------------|------------------------------|
| Unauthenticated | **401** | **401** |
| Seller | Own quotes only (`createdBy.uid === session.sub`) | Own only; **403** if another seller’s |
| Admin | All quotes | Any quote |

**Admin detection** (either is enough):

1. Firebase custom claim `admin === true` on the session cookie
2. Email listed in env `ADMIN_EMAILS` (comma-separated, case-insensitive)

Missing document → **404** (before ownership check when not found).

## Implementation

- Policy helpers: `src/lib/firebase/trip-quotes/access.ts` (`isAdmin`, `canReadTripQuote`)
- List/get repository: `listTripQuotesForUser`, `listTripQuotesAll`, `getTripQuoteByCotNumber`
- `[id]` accepts Firestore document id **or** `COT-XXXX`

## Response shape (list / get)

Minimal summary: `id`, `cotNumber`, `status`, `createdAt`, `clienteNombre`,
`precioFinal`, `createdBy.email`.
