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
