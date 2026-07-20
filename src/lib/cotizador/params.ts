/** Snapshot de Config TC + Parámetros (docs/). Editable vía env en el futuro. */

export const FORMULA_PARAMS = {
  tcArsUsd: 1420,
  flightTaxPct: 0.05,
  hotelTaxPct: 0.03,
  agencyMarginPct: 0.3,
  cardFeePct: 0.1,
  beetransferFeePct: 0.03,
  cashFeePct: 0,
  sellerMarginPct: 0.05,
  /** Default Gap 5: ajuste operador se aplica solo al adulto. */
  hotelAdjustmentAppliesTo: "adulto" as const,
} as const;

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

export function feeMultiplier(method: PaymentMethod): number {
  switch (method) {
    case "tarjeta":
      return 1 + FORMULA_PARAMS.cardFeePct;
    case "beetransfer":
      return 1 + FORMULA_PARAMS.beetransferFeePct;
    case "efectivo":
      return 1 + FORMULA_PARAMS.cashFeePct;
  }
}
