/**
 * Numeración COT-XXXX (4 dígitos).
 *
 * MVP sin DB: usa los últimos 4 dígitos de `Date.now()`.
 * Limitación: colisiones posibles bajo alta concurrencia; persistir contador
 * cuando haya backend de cotizaciones.
 */
export function generateCotNumber(now = Date.now()): string {
  const n = now % 10_000;
  return `COT-${String(n).padStart(4, "0")}`;
}

export function clientPdfFilename(cotNumber: string): string {
  return `${cotNumber}_cliente.pdf`;
}
