"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

type Currency = "ARS" | "USD";

function parseAndFormat(
  raw: string,
  currency: Currency,
  allowNegative: boolean,
): { display: string; value: number } {
  const allowDecimals = currency === "USD";
  const negative = allowNegative && raw.trim().startsWith("-");
  const cleaned = raw.replace(/[^\d,]/g, "");
  const [intRaw = "", ...rest] = cleaned.split(",");
  const intDigits = intRaw.replace(/^0+(?=\d)/, "");
  const hasComma = allowDecimals && rest.length > 0;
  const decDigits = hasComma ? rest.join("").slice(0, 2) : "";

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

function formatValue(value: number, currency: Currency): string {
  if (!value) return "";
  return value.toLocaleString("es-AR", {
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  });
}

export function MoneyField({
  id,
  value,
  currency,
  onValueChange,
  placeholder = "0",
  allowNegative = false,
}: {
  id?: string;
  value: number;
  currency: Currency;
  onValueChange: (value: number) => void;
  placeholder?: string;
  allowNegative?: boolean;
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
        {currency === "USD" ? "US$" : "$"}
      </span>
      <Input
        id={id}
        inputMode="decimal"
        className="pl-9 tabular-nums"
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
