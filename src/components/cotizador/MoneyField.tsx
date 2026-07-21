"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import type { FormMoneda } from "@/lib/validations/cotizacion";

/** Decimal places and UI prefix per destination cost currency. */
export const CURRENCY_UI: Record<
  FormMoneda,
  { decimals: number; prefix: string }
> = {
  USD: { decimals: 2, prefix: "US$" },
  PIX: { decimals: 2, prefix: "R$" },
  PEN: { decimals: 2, prefix: "S/" },
  ARS: { decimals: 0, prefix: "$" },
  CLP: { decimals: 0, prefix: "$" },
  COP: { decimals: 0, prefix: "$" },
};

function parseAndFormat(
  raw: string,
  currency: FormMoneda,
  allowNegative: boolean,
): { display: string; value: number } {
  const { decimals } = CURRENCY_UI[currency];
  const allowDecimals = decimals > 0;
  const negative = allowNegative && raw.trim().startsWith("-");
  const cleaned = raw.replace(/[^\d,]/g, "");
  const [intRaw = "", ...rest] = cleaned.split(",");
  const intDigits = intRaw.replace(/^0+(?=\d)/, "");
  const hasComma = allowDecimals && rest.length > 0;
  const decDigits = hasComma ? rest.join("").slice(0, decimals) : "";

  if (intDigits === "" && decDigits === "" && !hasComma) {
    return { display: negative ? "-" : "", value: 0 };
  }

  const sign = negative ? "-" : "";
  const intFormatted =
    intDigits === "" ? "" : Number(intDigits).toLocaleString("es-AR");
  const display = hasComma
    ? `${sign}${intFormatted === "" ? "0" : intFormatted},${decDigits}`
    : `${sign}${intFormatted}`;

  const numericStr = `${sign}${intDigits === "" ? "0" : intDigits}${
    decDigits ? `.${decDigits}` : ""
  }`;
  return { display, value: Number(numericStr) || 0 };
}

function formatValue(value: number, currency: FormMoneda): string {
  if (!value) return "";
  return value.toLocaleString("es-AR", {
    maximumFractionDigits: CURRENCY_UI[currency].decimals,
  });
}

export function MoneyField({
  id,
  value,
  currency,
  onValueChange,
  placeholder = "0",
  allowNegative = false,
  disabled = false,
  className,
}: {
  id?: string;
  value: number;
  currency: FormMoneda;
  onValueChange: (value: number) => void;
  placeholder?: string;
  allowNegative?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [display, setDisplay] = useState(() => formatValue(value, currency));

  // Sync when the value or currency changes externally (demo load, toggle).
  useEffect(() => {
    setDisplay((prev) => {
      const parsedPrev = parseAndFormat(prev, currency, allowNegative).value;
      if (parsedPrev === value) return prev;
      return formatValue(value, currency);
    });
  }, [value, currency, allowNegative]);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
        {CURRENCY_UI[currency].prefix}
      </span>
      <Input
        id={id}
        inputMode="decimal"
        disabled={disabled}
        className={`pl-9 tabular-nums${className ? ` ${className}` : ""}`}
        placeholder={placeholder}
        value={display}
        onChange={(event) => {
          const { display: next, value: numeric } = parseAndFormat(
            event.target.value,
            currency,
            allowNegative,
          );
          setDisplay(next);
          onValueChange(numeric);
        }}
      />
    </div>
  );
}
