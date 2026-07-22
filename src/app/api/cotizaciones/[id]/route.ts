import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  FirebaseDomainError,
  TripQuoteNotFoundError,
} from "@/lib/firebase/errors";
import { canReadTripQuote } from "@/lib/firebase/trip-quotes/access";
import {
  getTripQuoteByCotNumber,
  getTripQuoteById,
} from "@/lib/firebase/trip-quotes/repository";
import {
  isCotNumberParam,
  toTripQuoteSummary,
} from "@/lib/firebase/trip-quotes/summary";
import type { TripQuoteDoc } from "@/lib/firebase/trip-quotes/types";

export const runtime = "nodejs";

export type CotizacionByIdDeps = {
  getTripQuoteById?: typeof getTripQuoteById;
  getTripQuoteByCotNumber?: typeof getTripQuoteByCotNumber;
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Next.js App Router entry. */
export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return handleCotizacionByIdGet(request, id);
}

/**
 * GET /api/cotizaciones/[id] — fetch one trip quote by Firestore id or COT-XXXX.
 *
 * - 401 unauthenticated
 * - 404 missing
 * - 403 authenticated but not owner and not admin
 * - 200 `{ item: TripQuoteSummary }`
 */
export async function handleCotizacionByIdGet(
  _request: Request,
  id: string,
  deps: CotizacionByIdDeps = {},
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const byId = deps.getTripQuoteById ?? getTripQuoteById;
  const byCot = deps.getTripQuoteByCotNumber ?? getTripQuoteByCotNumber;

  try {
    let doc: TripQuoteDoc;
    try {
      doc = isCotNumberParam(id)
        ? await byCot(id.toUpperCase())
        : await byId(id);
    } catch (error) {
      if (error instanceof TripQuoteNotFoundError) {
        return NextResponse.json(
          { error: "Cotización no encontrada" },
          { status: 404 },
        );
      }
      throw error;
    }

    if (!canReadTripQuote(session, doc)) {
      return NextResponse.json({ error: "Prohibido" }, { status: 403 });
    }

    return NextResponse.json(
      { item: toTripQuoteSummary(doc) },
      { status: 200 },
    );
  } catch (error) {
    console.error("cotizaciones get error", error);
    const detail =
      error instanceof FirebaseDomainError
        ? error.message
        : "No se pudo obtener la cotización.";
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
