/** Snapshot of Config TC + formula params (docs/). Editable via admin/API later. */

/** Public formula knobs returned by `GET /api/rates` as `formulaParams`. */
export type FormulaParamsPublic = {
  tcArsUsd: number;
  flightTaxPct: number;
  hotelTaxPct: number;
  agencyMarginPct: number;
  cardFeePct: number;
  beetransferFeePct: number;
  cashFeePct: number;
  sellerMarginPct: number;
};

/** Full runtime params (public + Gap 5 hotel-adjustment policy). */
export type FormulaParams = FormulaParamsPublic & {
  /** Default Gap 5: operator adjustment applies only to the adult stay. */
  hotelAdjustmentAppliesTo: "adulto";
};

/**
 * Product formula base = **v2.8** (30% agency, × fees, 5% seller, CEILING).
 * Minors excursion policy is a documented v2.9 patch on top of v2.8 (see formula.ts).
 */
export const DEFAULT_FORMULA_PARAMS: FormulaParamsPublic = {
  tcArsUsd: 1420,
  flightTaxPct: 0.05,
  hotelTaxPct: 0.03,
  agencyMarginPct: 0.3,
  cardFeePct: 0.1,
  beetransferFeePct: 0.03,
  cashFeePct: 0,
  sellerMarginPct: 0.05,
};

/** Module default used by `calcularCotizacion` when no override is passed. */
export const FORMULA_PARAMS: FormulaParams = {
  ...DEFAULT_FORMULA_PARAMS,
  hotelAdjustmentAppliesTo: "adulto",
};

/**
 * Units of local currency per 1 USD (amount ÷ rate → USD).
 *
 * Fallback defaults only — live rates come from `GET /api/rates` / `fetchLiveRates()`.
 * - USD / ARS: snapshot values (ARS must equal `FORMULA_PARAMS.tcArsUsd`).
 * - PIX is a quote currency code (BRL-equivalent), not a payment rail.
 */
export const FX_RATES_TO_USD = {
  USD: 1,
  ARS: FORMULA_PARAMS.tcArsUsd,
  CLP: 950,
  COP: 4100,
  PIX: 5.5,
  PEN: 3.75,
} as const;

export type FxCurrency = keyof typeof FX_RATES_TO_USD;

export type PaymentMethod = "tarjeta" | "beetransfer" | "efectivo";

export function feeMultiplier(
  method: PaymentMethod,
  params: Pick<
    FormulaParamsPublic,
    "cardFeePct" | "beetransferFeePct" | "cashFeePct"
  > = FORMULA_PARAMS,
): number {
  switch (method) {
    case "tarjeta":
      return 1 + params.cardFeePct;
    case "beetransfer":
      return 1 + params.beetransferFeePct;
    case "efectivo":
      return 1 + params.cashFeePct;
  }
}
