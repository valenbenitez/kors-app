import type { CatalogExcursion } from "@/lib/cotizador/catalog";

function nightsBetween(ida: string, vuelta: string): number {
  const a = new Date(`${ida}T12:00:00`);
  const b = new Date(`${vuelta}T12:00:00`);
  return Math.max(Math.round((b.getTime() - a.getTime()) / 86_400_000), 1);
}

/** Genera itinerario determinístico (Gap 1) — editable por el vendedor. */
export function generateItinerary(options: {
  destino: string;
  fechaIda: string;
  fechaVuelta: string;
  hotelNombre?: string;
  excursiones: Pick<CatalogExcursion, "nombreLimpio">[];
}): string {
  const { destino, fechaIda, fechaVuelta, hotelNombre, excursiones } = options;
  const nights = nightsBetween(fechaIda, fechaVuelta);
  const days = nights + 1;
  const hotel = hotelNombre?.trim() || "hotel";
  const activities = excursiones.map((e) => e.nombreLimpio);
  const lines: string[] = [];
  let activityIdx = 0;

  for (let day = 1; day <= days; day++) {
    if (day === 1) {
      lines.push(
        `Día 1: Check-in ${destino} · ${hotel}. Tarde libre / llegada.`,
      );
      continue;
    }

    if (day === days) {
      lines.push(`Día ${day}: Check-out · traslado al aeropuerto · regreso.`);
      continue;
    }

    const remainingActivities = activities.length - activityIdx;
    if (remainingActivities <= 0) {
      lines.push(`Día ${day}: Tiempo libre / actividades opcionales.`);
      continue;
    }

    const middleDaysLeft = days - day; // includes current middle day until last-1
    const take = Math.max(
      1,
      Math.ceil(remainingActivities / Math.max(middleDaysLeft, 1)),
    );
    const chunk = activities.slice(activityIdx, activityIdx + take);
    activityIdx += chunk.length;
    lines.push(`Día ${day}: ${chunk.join(" · ")}`);
  }

  if (activityIdx < activities.length) {
    const leftover = activities.slice(activityIdx).join(" · ");
    if (days > 2) {
      lines[lines.length - 2] = `${lines[lines.length - 2]} · ${leftover}`;
    } else {
      lines[0] = `${lines[0]} · ${leftover}`;
    }
  }

  return lines.join("\n");
}
