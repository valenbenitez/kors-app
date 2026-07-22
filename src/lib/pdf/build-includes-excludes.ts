import { getPdfCopy } from "@/data/pdf-copy";
import { type CatalogExcursion, catalog } from "@/lib/cotizador/catalog";
import { cleanExcursionTitle } from "@/lib/cotizador/clean-title";
import {
  formatDateShortMonth,
  iataForDestination,
  nightsLabel,
  ORIGIN_IATA,
} from "@/lib/cotizador/format";
import type { CotizacionFormInput } from "@/lib/validations/cotizacion";

/** PDF copy when the client brings their own flights (no package flight cards). */
export const CLIENT_PROVIDED_FLIGHTS_COPY = "Vuelos aportados por el cliente";

/** Split free-text fields into non-empty lines for PDF lists / form textareas. */
export function textLines(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Join list items into newline-separated textarea text. */
export function linesToText(items: string[]): string {
  return items.join("\n");
}

/**
 * Display name for PDF: prefer catalog `nombreLimpio`.
 * Optional aliases are generic catalog product titles (not quote-specific).
 */
export function displayExcursionName(exc: CatalogExcursion): string {
  const raw = exc.nombre;
  if (/^PQT\s*01A/i.test(raw)) {
    return "PQT 01A · Transfer in/out + Cataratas Argentinas";
  }
  if (/CAT\s*BRASILERAS|PARQUE\s*DE\s*AVES/i.test(raw)) {
    return "Cataratas Brasileras + Parque de las Aves";
  }
  if (/GRAN\s*AVENTURA/i.test(raw)) {
    return "Gran Aventura — paseo en lancha bajo cataratas";
  }
  return exc.nombreLimpio || cleanExcursionTitle(raw);
}

type FlightLeg = "ida" | "vuelta";

export function flightLegFields(form: CotizacionFormInput, leg: FlightLeg) {
  const prefix = leg === "ida" ? "vueloIda" : "vueloVuelta";
  return {
    fecha: form[`${prefix}Fecha`],
    horaSalida: form[`${prefix}HoraSalida`],
    horaLlegada: form[`${prefix}HoraLlegada`],
    numero: form[`${prefix}Numero`],
    aeropuertoSalida: form[`${prefix}AeropuertoSalida`],
    aeropuertoLlegada: form[`${prefix}AeropuertoLlegada`],
  };
}

export function hasStructuredFlightLeg(
  form: CotizacionFormInput,
  leg: FlightLeg,
): boolean {
  const f = flightLegFields(form, leg);
  return Boolean(
    f.numero.trim() ||
      f.aeropuertoSalida.trim() ||
      f.aeropuertoLlegada.trim() ||
      f.horaSalida.trim() ||
      f.horaLlegada.trim() ||
      f.fecha.trim(),
  );
}

function formatFlightLegLine(
  form: CotizacionFormInput,
  leg: FlightLeg,
  airline: string,
): string {
  const f = flightLegFields(form, leg);
  const label = leg === "ida" ? "Vuelo ida" : "Vuelo vuelta";
  const flightId = [
    airline !== "Aerolínea a confirmar" ? airline : "",
    f.numero.trim(),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  const parts: string[] = [flightId ? `${label} ${flightId}` : label];

  const from = f.aeropuertoSalida.trim().toUpperCase();
  const to = f.aeropuertoLlegada.trim().toUpperCase();
  if (from && to) parts.push(`${from}→${to}`);
  else if (from || to) parts.push(from || to);

  const dep = f.horaSalida.trim();
  const arr = f.horaLlegada.trim();
  if (dep && arr) parts.push(`${dep}→${arr}`);
  else if (dep || arr) parts.push(dep || arr);

  if (f.fecha.trim()) parts.push(formatDateShortMonth(f.fecha));

  return parts.join(" · ");
}

export function packageHasFlights(form: CotizacionFormInput): boolean {
  if (form.clienteAportaVuelos) return false;
  return form.destinos.some(
    (d) =>
      d.vueloIdaAdultoArs +
        d.vueloIdaMenorArs +
        d.vueloVueltaAdultoArs +
        d.vueloVueltaMenorArs >
      0,
  );
}

/** Spec §6.8 — equipaje line when the package includes flights. */
function equipajeIncludeLine(
  equipaje: CotizacionFormInput["equipaje"],
): string {
  switch (equipaje) {
    case "carry-on":
      return "Equipaje de mano 10 kg (JetSMART Economy básico — sin valija despachada)";
    case "valija 15 kg":
      return "1 valija despachada hasta 15 kg + equipaje de mano";
    case "valija 23 kg":
      return "1 valija despachada hasta 23 kg + equipaje de mano";
    case "2 valijas":
      return "2 valijas despachadas + equipaje de mano";
    case "no incluye":
      return "Equipaje despachado no incluido — cliente compra aparte en aeropuerto o web aerolínea";
  }
}

function hotelIncludeLines(
  form: CotizacionFormInput,
  dest: CotizacionFormInput["destinos"][number],
): string[] {
  if (
    !(
      dest.hotelNoches > 0 &&
      dest.hotelAdultoNocheArs + dest.hotelMenorNocheArs > 0
    )
  ) {
    return [];
  }
  const name = dest.hotelNombre || "Hotel";
  const cat = dest.hotelCategoria ? ` ${dest.hotelCategoria}` : "";
  const nights =
    dest.hotelNoches > 0
      ? `${dest.hotelNoches} ${dest.hotelNoches === 1 ? "noche" : "noches"}`
      : nightsLabel(form.fechaIda, form.fechaVuelta);
  const habitacion = dest.hotelHabitacion ? ` · ${dest.hotelHabitacion}` : "";
  const regimen = dest.hotelRegimen ? ` · ${dest.hotelRegimen}` : "";
  return [
    `${name}${cat} · ${nights}${regimen}${habitacion}`.replace(/\s+/g, " "),
    ...textLines(dest.hotelIncluye),
  ];
}

/** Auto-build ¿Qué incluye? bullets from form + catalog. */
export function buildIncludesList(form: CotizacionFormInput): string[] {
  const items: string[] = [];
  if (form.destinos.length === 0) return items;

  if (form.clienteAportaVuelos) {
    items.push(CLIENT_PROVIDED_FLIGHTS_COPY);
  }

  const hasFlights = packageHasFlights(form);

  if (hasFlights) {
    const airline = form.aerolinea?.trim() || "Aerolínea a confirmar";
    const idaStructured = hasStructuredFlightLeg(form, "ida");
    const vueltaStructured = hasStructuredFlightLeg(form, "vuelta");

    if (idaStructured || vueltaStructured) {
      if (idaStructured) items.push(formatFlightLegLine(form, "ida", airline));
      if (vueltaStructured) {
        items.push(formatFlightLegLine(form, "vuelta", airline));
      }
    } else {
      const origin = ORIGIN_IATA === "AEP" ? "EZE" : ORIGIN_IATA;
      const seen = new Set<string>();
      for (const dest of form.destinos) {
        const destHas =
          dest.vueloIdaAdultoArs +
            dest.vueloIdaMenorArs +
            dest.vueloVueltaAdultoArs +
            dest.vueloVueltaMenorArs >
          0;
        if (!destHas) continue;
        const iata = iataForDestination(dest.destino);
        const key = `${origin}-${iata}`;
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(
          `2 vuelos ${airline} cabotaje ${origin}-${iata}-${origin} (ida + vuelta) con tasas`,
        );
      }
    }
    items.push(equipajeIncludeLine(form.equipaje));
  }

  for (const dest of form.destinos) {
    items.push(...hotelIncludeLines(form, dest));
    for (const id of dest.excursionIds) {
      const exc = catalog.find((e) => e.id === id);
      if (exc) items.push(displayExcursionName(exc));
    }
  }

  items.push("Asistencia al viajero básica");
  return items;
}

/**
 * Auto-build ¿Qué no incluye? bullets: destination copy excludes + hotelExcluye,
 * deduped across destinos.
 */
export function buildExcludesList(form: CotizacionFormInput): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const d of form.destinos) {
    for (const line of getPdfCopy(d.destino).excludes) {
      if (seen.has(line)) continue;
      seen.add(line);
      out.push(line);
    }
    for (const line of textLines(d.hotelExcluye)) {
      if (seen.has(line)) continue;
      seen.add(line);
      out.push(line);
    }
  }
  return out;
}

/** Prefill textarea values (newline-joined) for Confirmación. */
export function buildIncludesExcludesText(form: CotizacionFormInput): {
  incluyeTexto: string;
  excluyeTexto: string;
} {
  return {
    incluyeTexto: linesToText(buildIncludesList(form)),
    excluyeTexto: linesToText(buildExcludesList(form)),
  };
}
