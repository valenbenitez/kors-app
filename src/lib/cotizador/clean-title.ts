/** Limpia códigos internos de títulos de excursión (spec O.3). */
export function cleanExcursionTitle(raw: string): string {
  let s = raw;
  s = s.replace(/^(EXC |PQT \d+[A-Z]? · |PQT \d+[A-Z]? |EXC\d+ )/i, "");
  s = s.replace(
    /\s*[-—·]\s*(TITO|H1|NITES|CARACOL|VITIVINICOLA|BUS VITIVINICOLA|\(.*\))$/i,
    "",
  );
  s = s.replace(/^Excursi[óo]n\s+/i, "");
  // Quitar sufijos tipo "(REGULAR)" al final si quedaron
  s = s.replace(/\s*\((REGULAR|PRIVADO)\)\s*$/i, "");
  return s.trim();
}
