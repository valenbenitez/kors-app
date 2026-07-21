/**
 * Cot number helpers (filename). Sequential allocation lives in
 * `src/lib/firebase/counters/cotizaciones.ts` (`allocateCotNumber`).
 */

export { formatCotNumber } from "@/lib/firebase/counters/cotizaciones";

/**
 * @deprecated Prefer `allocateCotNumber` for persisted quotes.
 * Kept for preview / offline callers that only need a display stub.
 */
export function generateCotNumber(now = Date.now()): string {
  const n = now % 10_000;
  return `COT-${String(n).padStart(4, "0")}`;
}

export function clientPdfFilename(cotNumber: string): string {
  return `${cotNumber}_cliente.pdf`;
}
