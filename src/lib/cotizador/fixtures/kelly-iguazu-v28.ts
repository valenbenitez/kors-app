import type { CotizacionInput } from "@/lib/cotizador/formula";

/**
 * Spec §5 golden — Kelly / Iguazú → USD 1289 (CEILING).
 *
 * Labeled **COT-0007** in `docs/mvp/Cotizador-web-spec.md` (v2.8 bit-exact).
 * Notion/CSV also used that id for Nina; this fixture is the Kelly example only.
 *
 * PRD task names mentioned COT-0001..0006 — those historical rows are **v2.7**
 * (wrong goldens: 35% agency, fee ÷). Spec says bit-exact from COT-0007+.
 * We do **not** invent fake 0001–0006 fixtures.
 *
 * Assumptions (hotel-noches migration):
 * - Spec stay total adult ARS 399.207 with operator adjustment −47.905 → net 351.302
 *   (matches Paso 1 hotel USD 247.40 @ TC 1420).
 * - `hotelNoches: 1` × `hotelAdultoNocheArs: 399_207` preserves that stay total
 *   without inventing a nights count (spec dates 14–16 Aug imply 2 nights, but
 *   only the stay total is documented for the golden).
 * - Excursions: Cataratas Arg+Bras USD 220 + Gran Aventura USD 85 = 305.
 *
 * Intermediate table in the spec shows post-fee 1224.15 / final 1288.58;
 * Decimal HALF_UP on our path yields 1224.16 / 1288.59. Cliente CEILING is
 * still **1289** — that is the acceptance golden.
 */
export const KELLY_IGUAZU_V28_INPUT: CotizacionInput = {
  paxAdultos: 1,
  paxMenores: 0,
  metodoPago: "tarjeta",
  tcArsUsd: 1420,
  destinos: [
    {
      destino: "Iguazú",
      vueloIdaAdultoArs: 147_500,
      vueloIdaMenorArs: 0,
      vueloVueltaAdultoArs: 147_881,
      vueloVueltaMenorArs: 0,
      hotelNoches: 1,
      hotelAdultoNocheArs: 399_207,
      hotelMenorNocheArs: 0,
      hotelAjusteArs: -47_905,
      hotelNombre: "Amérian Portal del Iguazú",
      hotelCategoria: "5★",
      hotelRegimen: "Desayuno buffet incluido",
      hotelUbicacion: "Puerto Iguazú, 1.91 km del centro",
      excursiones: [
        {
          id: "cat-arg-bra",
          nombre: "Cataratas Argentinas + Brasileras",
          neto: 220,
          moneda: "USD",
          precioMenor: null,
          politicaMenores: "Mismo adulto",
        },
        {
          id: "gran-aventura",
          nombre: "Gran Aventura",
          neto: 85,
          moneda: "USD",
          precioMenor: null,
          politicaMenores: "Mismo adulto",
        },
      ],
    },
  ],
};

export const KELLY_IGUAZU_V28_PRECIO_FINAL_CLIENTE = 1289;
