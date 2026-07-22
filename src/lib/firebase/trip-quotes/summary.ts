import type { TripQuoteDoc } from "@/lib/firebase/trip-quotes/types";

/** Minimal trip-quote summary for list/get API responses. */
export type TripQuoteSummary = {
  id: string;
  cotNumber: string;
  status: TripQuoteDoc["status"];
  createdAt: string;
  clienteNombre: string;
  precioFinal: number;
  createdBy: { email: string };
};

/** Maps a Firestore trip quote to the public summary DTO. */
export function toTripQuoteSummary(doc: TripQuoteDoc): TripQuoteSummary {
  return {
    id: doc.id,
    cotNumber: doc.cotNumber,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    clienteNombre: doc.clienteNombre ?? doc.form.clienteNombre,
    precioFinal: doc.precioFinalCliente ?? doc.result.precioFinalCliente,
    createdBy: { email: doc.createdBy.email },
  };
}

/** True when the path segment looks like a COT-XXXX number. */
export function isCotNumberParam(value: string): boolean {
  return /^COT-\d+$/i.test(value);
}
