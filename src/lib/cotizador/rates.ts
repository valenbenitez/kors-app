import Decimal from "decimal.js";
import { FX_RATES_TO_USD } from "@/lib/cotizador/params";
import type { FormMoneda } from "@/lib/validations/cotizacion";
import { MONEDAS } from "@/lib/validations/cotizacion";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/** Units of local currency per 1 USD, keyed by form currency codes. */
export type FxRatesMap = Record<FormMoneda, number>;

/** Convert catalog amount (ARS|USD) to form currency using rates map. */
export function convertCatalogAmountToForm(
  amount: number,
  from: "ARS" | "USD",
  to: FormMoneda,
  rates: FxRatesMap,
): number {
  const usd =
    from === "USD" ? new Decimal(amount) : new Decimal(amount).div(rates.ARS);
  return usd.times(rates[to]).toNumber();
}

/** Raw sheet columns (Google Sheet CSV / JSON). Sheet uses BRL; form uses PIX. */
export type SheetRatesRaw = {
  USD: number;
  ARS: number;
  CLP: number;
  COP: number;
  PEN: number;
  BRL: number;
  MXN?: number;
};

const FORM_RATE_KEYS: FormMoneda[] = [...MONEDAS];

const USD_TOLERANCE = 0.01;

export class RatesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RatesError";
  }
}

/** Hardcoded snapshot used when live sheet fetch fails (demos / offline). */
export function fallbackFxRates(): FxRatesMap {
  return {
    USD: FX_RATES_TO_USD.USD,
    ARS: FX_RATES_TO_USD.ARS,
    CLP: FX_RATES_TO_USD.CLP,
    COP: FX_RATES_TO_USD.COP,
    PIX: FX_RATES_TO_USD.PIX,
    PEN: FX_RATES_TO_USD.PEN,
  };
}

function assertFinitePositive(value: number, key: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RatesError(`Invalid rate for ${key}: expected finite number > 0`);
  }
}

/**
 * Maps sheet rates (BRL) to form rates (PIX).
 * Validates USD ≈ 1 and all required keys are finite and positive.
 */
export function normalizeSheetRates(raw: Record<string, number>): FxRatesMap {
  const usd = raw.USD;
  const ars = raw.ARS;
  const clp = raw.CLP;
  const cop = raw.COP;
  const pen = raw.PEN;
  const brl = raw.BRL;

  for (const [key, value] of [
    ["USD", usd],
    ["ARS", ars],
    ["CLP", clp],
    ["COP", cop],
    ["PEN", pen],
    ["BRL", brl],
  ] as const) {
    if (value === undefined || Number.isNaN(value)) {
      throw new RatesError(`Missing required rate: ${key}`);
    }
    assertFinitePositive(value, key);
  }

  if (Math.abs(usd - 1) > USD_TOLERANCE) {
    throw new RatesError(`USD rate must be ≈ 1, got ${usd}`);
  }

  return {
    USD: usd,
    ARS: ars,
    CLP: clp,
    COP: cop,
    PEN: pen,
    PIX: brl,
  };
}

/** Parses a two-line CSV (header + values) from the rates Google Sheet. */
export function parseRatesCsv(text: string): FxRatesMap {
  const [headerLine, valuesLine] = text
    .trim()
    .split("\n")
    .map((line) => line.trim());

  if (!headerLine || !valuesLine) {
    throw new RatesError("Invalid rates sheet format");
  }

  const currencies = headerLine.split(",").map((c) => c.trim());
  const values = valuesLine.split(",").map((v) => v.trim());

  if (currencies.length === 0 || currencies.length !== values.length) {
    throw new RatesError("Rates CSV header/value length mismatch");
  }

  const raw: Record<string, number> = {};
  for (let i = 0; i < currencies.length; i++) {
    const code = currencies[i];
    if (!code) continue;
    raw[code] = Number(values[i]);
  }

  return normalizeSheetRates(raw);
}

/**
 * Fetches live FX rates from `RATES_URL` (Google Sheet CSV export).
 * Throws {@link RatesError} when the URL is missing or the payload is invalid.
 */
export async function fetchLiveRates(): Promise<FxRatesMap> {
  const url = process.env.RATES_URL;
  if (!url) {
    throw new RatesError("RATES_URL is not configured");
  }

  let text: string;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new RatesError(`Rates fetch failed with status ${res.status}`);
    }
    text = await res.text();
  } catch (error) {
    if (error instanceof RatesError) throw error;
    throw new RatesError(
      error instanceof Error ? error.message : "Rates fetch failed",
    );
  }

  return parseRatesCsv(text);
}

/**
 * Live rates when available; otherwise hardcoded {@link FX_RATES_TO_USD}.
 * Same policy for wizard demos and server PDF generation when the sheet is down.
 */
export async function resolveRates(): Promise<{
  rates: FxRatesMap;
  source: "live" | "fallback";
}> {
  try {
    const rates = await fetchLiveRates();
    return { rates, source: "live" };
  } catch {
    return { rates: fallbackFxRates(), source: "fallback" };
  }
}

/** Type guard: every FormMoneda key is present and finite > 0. */
export function isFxRatesMap(value: unknown): value is FxRatesMap {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  for (const key of FORM_RATE_KEYS) {
    const n = record[key];
    if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return false;
  }
  return true;
}
