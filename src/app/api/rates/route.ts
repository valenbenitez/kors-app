import { NextResponse } from "next/server";
import {
  buildRatesApiResponse,
  parseRatesCsv,
  RatesError,
} from "@/lib/cotizador/rates";

export async function GET() {
  const ratesUrl = process.env.RATES_URL;
  if (!ratesUrl) {
    return NextResponse.json(
      { error: "RATES_URL is not configured" },
      { status: 500 },
    );
  }

  try {
    const text = await fetch(ratesUrl, { cache: "no-store" }).then((res) => {
      if (!res.ok) {
        throw new RatesError(`Rates fetch failed with status ${res.status}`);
      }
      return res.text();
    });

    const rates = parseRatesCsv(text);
    return NextResponse.json(buildRatesApiResponse(rates));
  } catch (error) {
    const message =
      error instanceof RatesError
        ? error.message
        : "Failed to load exchange rates";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
