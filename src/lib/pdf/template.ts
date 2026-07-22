import { getPdfCopy } from "@/data/pdf-copy";
import { type CatalogExcursion, catalog } from "@/lib/cotizador/catalog";
import { cleanExcursionTitle } from "@/lib/cotizador/clean-title";
import {
  addDaysIso,
  feeMultiplierLabel,
  formatDateEs,
  formatDateShortMonth,
  iataForDestination,
  nightsLabel,
  ORIGIN_IATA,
  paymentFooterLine,
  VALIDEZ_COTIZACION_DIAS,
  weekdayLongEs,
} from "@/lib/cotizador/format";
import type { FormulaResult } from "@/lib/cotizador/formula";
import { getLogoDataUrl } from "@/lib/pdf/logo";
import { mergePdfTheme, type PdfThemeOverride } from "@/lib/pdf/theme";
import type { CotizacionFormInput } from "@/lib/validations/cotizacion";

export type PdfTag = {
  emoji: string;
  label: string;
  accent?: boolean;
};

export type PdfRenderData = {
  cotNumber: string;
  form: CotizacionFormInput;
  result: FormulaResult;
  generatedAt: string;
  /** Override para fixture visual; default = generatedAt + VALIDEZ_COTIZACION_DIAS */
  validUntil?: string;
  includes?: string[];
  excludes?: string[];
  hotelHighlights?: string[];
  tags?: PdfTag[];
  locationLabel?: string;
  guideSubtitle?: string;
  /** Precios USD/pax forzados por id de excursión (fixture) */
  experiencePricesUsd?: Record<string, number>;
  /** Partial PDF theme override (colors, fonts, brand, footer, logo). */
  theme?: PdfThemeOverride;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function starsLabel(categoria?: string): string {
  if (!categoria) return "";
  const n = Number.parseInt(categoria, 10);
  if (!Number.isFinite(n)) return categoria;
  return "★".repeat(n);
}

function money(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(n);
}

function firstName(full: string): string {
  return full.split(/\s+/)[0] || full;
}

/**
 * Display name for PDF: prefer catalog `nombreLimpio`.
 * Optional aliases are generic catalog product titles (not quote-specific).
 */
function displayExcursionName(exc: CatalogExcursion): string {
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

function experienceDetail(exc: CatalogExcursion): string {
  return exc.proveedor?.trim() ? `proveedor ${exc.proveedor.trim()}` : "";
}

/** Split free-text hotel fields into non-empty lines for PDF lists. */
function textLines(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

type FlightLeg = "ida" | "vuelta";

function flightLegFields(form: CotizacionFormInput, leg: FlightLeg) {
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

function hasStructuredFlightLeg(
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

/** PDF copy when the client brings their own flights (no package flight cards). */
export const CLIENT_PROVIDED_FLIGHTS_COPY = "Vuelos aportados por el cliente";

function packageHasFlights(form: CotizacionFormInput): boolean {
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

function includesList(form: CotizacionFormInput): string[] {
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

/** Dedicated flights block (spec §6.7) — empty when all flight costs are 0. */
function flightsSectionHtml(form: CotizacionFormInput): string {
  if (form.clienteAportaVuelos) {
    return `<div class="flights-block">
    <h2 class="section-title">Vuelos</h2>
    <p class="flights-client-notice">${escapeHtml(CLIENT_PROVIDED_FLIGHTS_COPY)}</p>
  </div>`;
  }

  if (!packageHasFlights(form)) return "";

  const airline = form.aerolinea?.trim() || "Aerolínea a confirmar";
  const idaStructured = hasStructuredFlightLeg(form, "ida");
  const vueltaStructured = hasStructuredFlightLeg(form, "vuelta");
  const cards: string[] = [];

  if (idaStructured || vueltaStructured) {
    if (idaStructured) {
      const f = flightLegFields(form, "ida");
      cards.push(
        flightCardHtml({
          legLabel: "Ida",
          airline,
          numero: f.numero,
          from: f.aeropuertoSalida,
          to: f.aeropuertoLlegada,
          dep: f.horaSalida,
          arr: f.horaLlegada,
          fecha: f.fecha,
        }),
      );
    }
    if (vueltaStructured) {
      const f = flightLegFields(form, "vuelta");
      cards.push(
        flightCardHtml({
          legLabel: "Vuelta",
          airline,
          numero: f.numero,
          from: f.aeropuertoSalida,
          to: f.aeropuertoLlegada,
          dep: f.horaSalida,
          arr: f.horaLlegada,
          fecha: f.fecha,
        }),
      );
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
      cards.push(
        flightCardHtml({
          legLabel: "Ida + vuelta",
          airline,
          numero: "",
          from: origin,
          to: iata,
          dep: "",
          arr: "",
          fecha: "",
          summary: `Cabotaje ${origin}–${iata}–${origin} con tasas`,
        }),
      );
    }
  }

  if (cards.length === 0) return "";

  return `<div class="flights-block">
    <h2 class="section-title">Vuelos</h2>
    <div class="flight-cards">${cards.join("")}</div>
  </div>`;
}

function flightCardHtml(opts: {
  legLabel: string;
  airline: string;
  numero: string;
  from: string;
  to: string;
  dep: string;
  arr: string;
  fecha: string;
  summary?: string;
}): string {
  const route =
    opts.from.trim() && opts.to.trim()
      ? `${opts.from.trim().toUpperCase()} → ${opts.to.trim().toUpperCase()}`
      : opts.from.trim().toUpperCase() ||
        opts.to.trim().toUpperCase() ||
        opts.summary ||
        "";
  const times =
    opts.dep.trim() && opts.arr.trim()
      ? `${opts.dep.trim()} → ${opts.arr.trim()}`
      : opts.dep.trim() || opts.arr.trim();
  const flightId = [opts.airline, opts.numero.trim()].filter(Boolean).join(" ");

  return `<div class="flight-card">
    <div class="flight-leg">${escapeHtml(opts.legLabel)}</div>
    <div class="flight-main">
      <div class="flight-id">${escapeHtml(flightId || "Vuelo a confirmar")}</div>
      ${route ? `<div class="flight-route">${escapeHtml(route)}</div>` : ""}
      ${times ? `<div class="flight-times">${escapeHtml(times)}</div>` : ""}
      ${opts.fecha.trim() ? `<div class="flight-date">${escapeHtml(formatDateShortMonth(opts.fecha))}</div>` : ""}
      ${opts.summary && !route ? `<div class="flight-route">${escapeHtml(opts.summary)}</div>` : ""}
    </div>
  </div>`;
}

function itineraryHtml(text: string): string {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    return `<div class="day"><div class="day-content muted">Itinerario a confirmar con el asesor.</div></div>`;
  }

  return blocks
    .map((block) => {
      const lines = block.split("\n").filter(Boolean);
      const head = lines[0] ?? "";
      const body = lines.slice(1).join(" ").trim();
      // "Día 1 · Mar 28 Jul: Título del día"
      const match = head.match(/^D[ií]a\s+(\d+)\s*·\s*([^:]+):\s*(.+)$/i);
      if (!match) {
        return `<div class="day"><div class="day-content">${escapeHtml(block)}</div></div>`;
      }
      const badge = `DÍA ${match[1]} · ${match[2].trim().toUpperCase()}`;
      const title = match[3].trim();
      return `<div class="day">
        <div class="day-badge">${escapeHtml(badge)}</div>
        <div class="day-body">
          <div class="day-title">${escapeHtml(title)}</div>
          ${body ? `<div class="day-content">${escapeHtml(body)}</div>` : ""}
        </div>
      </div>`;
    })
    .join("");
}

function mapHtml(lat: number, lng: number, pinLabel: string): string {
  if (lat === 0 && lng === 0) {
    return `<div class="map-fallback">Mapa de ${escapeHtml(pinLabel)} disponible con el asesor.</div>`;
  }
  const mapsUrl = `https://www.google.com/maps/place/${encodeURIComponent(pinLabel)}/@${lat},${lng},11z`;
  return `
  <a class="map-card" href="${mapsUrl}" target="_blank" rel="noopener">
    <div class="map-canvas" aria-hidden="true">
      <div class="map-land map-br"></div>
      <div class="map-land map-py"></div>
      <div class="map-land map-ar"></div>
      <div class="map-water"></div>
      <div class="map-pin">
        <span class="map-pin-dot"></span>
        <span class="map-pin-label">${escapeHtml(pinLabel)}</span>
      </div>
      <div class="map-label map-label-br">Brasil</div>
      <div class="map-label map-label-py">Paraguay</div>
      <div class="map-label map-label-ar">Argentina</div>
    </div>
    <div class="map-caption">📍 ${escapeHtml(pinLabel)} · ${lat}, ${lng} · Abrir en Google Maps ↗</div>
  </a>`;
}

function destinationTitle(form: CotizacionFormInput): string {
  const names = form.destinos.map((d) => d.destino).filter(Boolean);
  if (names.length === 0) {
    return form.destinosSeleccionados[0] ?? "";
  }
  return names.join(" + ");
}

function hotelBlockHtml(
  form: CotizacionFormInput,
  dest: CotizacionFormInput["destinos"][number],
  highlights: string[],
  opts?: { showDestinoLabel?: boolean },
): string {
  const meta = [
    dest.hotelNoches > 0
      ? `${dest.hotelNoches} ${dest.hotelNoches === 1 ? "noche" : "noches"}`
      : nightsLabel(form.fechaIda, form.fechaVuelta),
    `${weekdayLongEs(form.fechaIda).slice(0, 3)} ${formatDateShortMonth(form.fechaIda).replace(/ \d{4}$/, "")} → ${weekdayLongEs(form.fechaVuelta).slice(0, 3)} ${formatDateShortMonth(form.fechaVuelta).replace(/ \d{4}$/, "")}`,
    dest.hotelUbicacion || null,
    dest.hotelHabitacion || null,
    dest.hotelRegimen || null,
  ]
    .filter(Boolean)
    .join(" · ");

  const destLabel = opts?.showDestinoLabel
    ? `<div class="hotel-destino">${escapeHtml(dest.destino.toUpperCase())}</div>`
    : "";

  return `<div class="hotel-block">
    ${destLabel}
    <div class="hotel-name">🌳 ${escapeHtml(dest.hotelNombre || "Hotel")} <span class="stars">${starsLabel(dest.hotelCategoria || undefined)}</span></div>
    <div class="hotel-meta">${escapeHtml(meta)}</div>
    ${
      highlights.length
        ? `<ul class="checks ok">${highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join("")}</ul>`
        : ""
    }
  </div>`;
}

function experiencesForDestinosHtml(
  form: CotizacionFormInput,
  result: FormulaResult,
  experiencePricesUsd?: Record<string, number>,
): string {
  const groups = form.destinos
    .map((dest) => {
      const rows = dest.excursionIds
        .map((id) => {
          const exc = catalog.find((e) => e.id === id);
          if (!exc) return null;
          const usd =
            experiencePricesUsd?.[id] ??
            (exc.moneda === "USD"
              ? Math.round(exc.neto)
              : Math.round(exc.neto / result.tcArsUsd));
          return {
            name: displayExcursionName(exc),
            detail: experienceDetail(exc),
            usd,
          };
        })
        .filter((x): x is { name: string; detail: string; usd: number } =>
          Boolean(x),
        );
      if (rows.length === 0) return null;
      return { destino: dest.destino, rows };
    })
    .filter((g): g is NonNullable<typeof g> => Boolean(g));

  if (groups.length === 0) {
    return `<p class="muted">Sin excursiones seleccionadas.</p>`;
  }

  return groups
    .map(
      (g) => `<div class="exp-group">
        <div class="exp-group-title">💧 ${escapeHtml(g.destino.toUpperCase())} · ${g.rows.length} EXPERIENCIA${g.rows.length === 1 ? "" : "S"}</div>
        ${g.rows
          .map(
            (row) => `<div class="exp-row">
            <div>
              <div class="exp-name">${escapeHtml(row.name)}</div>
              ${row.detail ? `<div class="exp-detail">${escapeHtml(row.detail)}</div>` : ""}
            </div>
            <div class="exp-price">USD ${money(row.usd)} / pax</div>
          </div>`,
          )
          .join("")}
      </div>`,
    )
    .join("");
}

/**
 * Template PDF cliente alineado a COT-0010 (single = 3 páginas A4).
 * Multi (2+ destinos) = 4 páginas: P4 mapas por destino + CTA.
 * Sin desglose financiero interno / auditoría.
 */
export function renderPdfHtml(data: PdfRenderData): string {
  const { cotNumber, form, result, generatedAt } = data;
  const isMulti = form.destinos.length >= 2;
  const pageCount = isMulti ? 4 : 3;
  const dest = form.destinos[0];
  const destino = destinationTitle(form);
  const primaryCopy = getPdfCopy(
    dest?.destino ?? form.destinosSeleccionados[0] ?? "",
  );
  const validUntil =
    data.validUntil ?? addDaysIso(generatedAt, VALIDEZ_COTIZACION_DIAS);
  const totalPax = form.paxAdultos + form.paxMenores;
  const paxLabel =
    form.paxMenores > 0
      ? `${form.paxAdultos} adultos + ${form.paxMenores} ${form.paxMenores === 1 ? "niño" : "niños"}`
      : `${form.paxAdultos} ${form.paxAdultos === 1 ? "adulto" : "adultos"}`;
  const agesLabel =
    form.edadesMenores.length > 0
      ? `Edades menores: ${form.edadesMenores.join(" y ")} años`
      : "";

  const includes = data.includes ?? includesList(form);
  const excludes =
    data.excludes ??
    (() => {
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
    })();
  const tags =
    data.tags ??
    primaryCopy.defaultTags.map((t) =>
      t.label === "Familia" && totalPax > 0
        ? { ...t, label: `Familia ${totalPax} pax` }
        : t,
    );
  const locationLabel =
    data.locationLabel ??
    (isMulti
      ? form.destinos
          .map((d) => getPdfCopy(d.destino).locationLabel)
          .join(" · ")
      : primaryCopy.locationLabel);
  const guideSubtitle =
    data.guideSubtitle ??
    (isMulti
      ? `${destino} · ${form.perfil}`
      : primaryCopy.guideSubtitle({
          perfil: form.perfil,
          seasonHint: primaryCopy.climate.season.toLowerCase(),
        }));

  const theme = mergePdfTheme(data.theme);
  const { brandName, colors, fonts, footer } = theme;
  const logo = getLogoDataUrl(theme.logo.path);
  const feeLabel = feeMultiplierLabel(form.metodoPago);

  const experiencesHtml = experiencesForDestinosHtml(
    form,
    result,
    data.experiencePricesUsd,
  );

  const hotelsHtml = form.destinos
    .map((d, idx) => {
      const copy = getPdfCopy(d.destino);
      const highlights =
        !isMulti && idx === 0 && data.hotelHighlights
          ? data.hotelHighlights
          : [
              ...(isMulti ? [] : copy.hotelHighlights),
              d.hotelUbicacion ? `Ubicación: ${d.hotelUbicacion}` : null,
              d.hotelAjusteRazon || null,
              ...textLines(d.hotelCondiciones),
            ].filter((x): x is string => Boolean(x));
      return hotelBlockHtml(form, d, highlights, {
        showDestinoLabel: isMulti,
      });
    })
    .join("");

  const stripHotelSub = isMulti
    ? form.destinos
        .map((d) => d.hotelNombre || d.destino)
        .filter(Boolean)
        .join(" · ")
    : `${dest?.hotelNombre || "—"}${dest?.hotelCategoria ? ` ${dest.hotelCategoria}` : ""}`;

  const flightsHtml = flightsSectionHtml(form);

  /** Collect unique upsells across destinos (skip empty). */
  const upsellHtml = (() => {
    const seen = new Set<string>();
    const cards: string[] = [];
    for (const d of form.destinos) {
      for (const u of getPdfCopy(d.destino).upsells) {
        if (seen.has(u.title)) continue;
        seen.add(u.title);
        cards.push(`<div class="upsell-card">
            <div class="upsell-emoji">${u.emoji}</div>
            <div class="upsell-price">USD ${money(u.priceUsd)} / pax</div>
            <div class="upsell-title">${escapeHtml(u.title)}</div>
            <div class="upsell-body">${escapeHtml(u.body)}</div>
            <div class="upsell-badge">${escapeHtml(u.badge)}</div>
          </div>`);
      }
    }
    return cards.length
      ? `<div class="upsell-grid">${cards.join("")}</div>`
      : "";
  })();

  const editorialSectionsHtml = (() => {
    const parts: string[] = [];
    for (const d of form.destinos) {
      const copy = getPdfCopy(d.destino);
      const prefix = isMulti
        ? `<div class="dest-editorial-label">${escapeHtml(d.destino.toUpperCase())}</div>`
        : "";

      if (copy.tips.length > 0) {
        parts.push(`${prefix}<h2 class="section-title">Tips familia + niños</h2>
    <div class="tips-grid">
      ${copy.tips
        .map(
          (t) => `<div class="tip-card">
          <div>${t.emoji}</div>
          <div class="t">${escapeHtml(t.title)}</div>
          <div class="b">${escapeHtml(t.body)}</div>
        </div>`,
        )
        .join("")}
    </div>`);
      }

      if (copy.gastro.length > 0) {
        parts.push(`${isMulti && copy.tips.length === 0 ? prefix : ""}<h2 class="section-title">Gastronomía recomendada</h2>
    <div class="gastro-list">
      ${copy.gastro
        .map(
          (g) => `<div class="gastro-item">
          <div>${g.emoji}</div>
          <div>
            <div class="gastro-name">${escapeHtml(g.name)}</div>
            <div class="gastro-body">${escapeHtml(g.body)}</div>
          </div>
          <a class="gastro-link" href="https://www.google.com/maps/search/?api=1&query=${g.mapsQuery}" target="_blank" rel="noopener">Ver en Google Maps ↗</a>
        </div>`,
        )
        .join("")}
    </div>`);
      }

      if (copy.climate.body.trim()) {
        parts.push(`<h2 class="section-title">Clima en tu viaje${isMulti ? ` — ${escapeHtml(d.destino)}` : ""}</h2>
    <div class="climate-box">
      <div class="climate-badge">
        <div class="s">🌳 ${escapeHtml(copy.climate.season)}</div>
        <div class="r">${escapeHtml(copy.climate.range)}</div>
      </div>
      <div class="climate-body">${escapeHtml(copy.climate.body)}</div>
    </div>`);
      }

      if (copy.packing.length > 0) {
        parts.push(`<h2 class="section-title">${escapeHtml(copy.packingTitle)}</h2>
    <div class="pack-grid">
      ${copy.packing
        .map(
          (p) => `<div class="pack-card">
          <div>${p.emoji}</div>
          <div class="t">${escapeHtml(p.title)}</div>
          <div class="b">${escapeHtml(p.body)}</div>
        </div>`,
        )
        .join("")}
    </div>`);
      }

      // Single: one destino. Multi: page 3 is denser editorial; maps move to page 4.
      if (!isMulti) break;
    }
    return parts.join("\n");
  })();

  const mapsSectionHtml = (() => {
    const blocks = form.destinos
      .map((d) => {
        const copy = getPdfCopy(d.destino);
        const hasCoords = !(copy.map.lat === 0 && copy.map.lng === 0);
        if (!hasCoords && !copy.map.summary.trim()) return null;
        return `<div class="map-dest-block">
          <h2 class="section-title">Dónde queda ${escapeHtml(d.destino.toUpperCase())}</h2>
          <div class="map-layout">
            <div class="map-summary">${escapeHtml(copy.map.summary)}</div>
            ${hasCoords ? mapHtml(copy.map.lat, copy.map.lng, copy.map.pinLabel) : `<div class="map-fallback">Mapa de ${escapeHtml(copy.map.pinLabel)} disponible con el asesor.</div>`}
          </div>
        </div>`;
      })
      .filter(Boolean);
    return blocks.join("");
  })();

  const heroDestClass = isMulti ? "hero-dest hero-dest-multi" : "hero-dest";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(cotNumber)} · ${escapeHtml(destino.toUpperCase())} · ${escapeHtml(brandName)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: var(--font-body);
    color: var(--text);
    background: var(--bg);
    font-size: 10.5px;
    line-height: 1.45;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 210mm;
    height: 297mm;
    padding: 10mm 11mm 12mm;
    page-break-after: always;
    position: relative;
    overflow: hidden;
  }
  .page:last-child { page-break-after: auto; }

  :root {
    --navy: ${colors.navy};
    --navy-deep: ${colors.navyDeep};
    --gold: ${colors.gold};
    --gold-bright: ${colors.goldBright};
    --cream: ${colors.cream};
    --cream-soft: ${colors.creamSoft};
    --muted: ${colors.muted};
    --line: ${colors.line};
    --ok: ${colors.ok};
    --no: ${colors.no};
    --orange-bar: ${colors.orangeBar};
    --text: ${colors.text};
    --bg: ${colors.background};
    --font-body: ${fonts.body};
    --font-display: ${fonts.display};
  }

  .hero {
    background: linear-gradient(145deg, var(--navy-deep) 0%, var(--navy) 55%, #243a63 100%);
    color: #fff;
    border-radius: 16px;
    padding: 16px 18px 14px;
    display: grid;
    grid-template-columns: 1.35fr 0.85fr;
    gap: 12px;
    align-items: end;
  }
  .hero-logo { height: 28px; width: auto; display: block; margin-bottom: 10px; filter: brightness(0) invert(1); }
  .hero-hello { font-size: 13px; font-weight: 400; opacity: 0.95; margin: 0 0 4px; }
  .hero-dest {
    font-family: var(--font-display);
    font-size: 42px;
    font-weight: 700;
    letter-spacing: 0.04em;
    line-height: 1;
    margin: 2px 0 6px;
  }
  .hero-dest-multi {
    font-size: 26px;
    letter-spacing: 0.02em;
    line-height: 1.15;
  }
  .flights-block { margin-top: 12px; }
  .flights-client-notice {
    margin: 0;
    font-size: 11px;
    color: #2a3348;
  }
  .flight-cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .flight-card {
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 10px 12px;
    background: var(--cream-soft);
  }
  .flight-leg {
    font-size: 8px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 700;
  }
  .flight-id { font-weight: 700; font-size: 12px; color: var(--navy); margin-top: 3px; }
  .flight-route { font-size: 11px; color: var(--navy); margin-top: 2px; }
  .flight-times, .flight-date { font-size: 9.5px; color: var(--muted); margin-top: 2px; }
  .hotel-block + .hotel-block { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--line); }
  .hotel-destino {
    font-size: 9px;
    letter-spacing: 0.12em;
    font-weight: 700;
    color: var(--gold);
    margin-bottom: 4px;
  }
  .dest-editorial-label {
    font-size: 10px;
    letter-spacing: 0.14em;
    font-weight: 700;
    color: var(--navy);
    margin: 10px 0 6px;
  }
  .map-dest-block { margin-bottom: 14px; }
  .map-fallback {
    background: var(--cream-soft);
    border-radius: 12px;
    padding: 16px;
    font-size: 10px;
    color: var(--muted);
  }
  .hero-loc { font-size: 11px; opacity: 0.9; margin-bottom: 10px; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .tag {
    font-size: 9px;
    padding: 4px 9px;
    border-radius: 999px;
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.18);
    white-space: nowrap;
  }
  .tag.accent { background: var(--gold); color: var(--navy); border-color: var(--gold); font-weight: 700; }
  .hero-price { text-align: right; }
  .hero-price .pp-label {
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--gold-bright);
    font-weight: 700;
  }
  .hero-price .pp-value {
    font-family: var(--font-display);
    font-size: 36px;
    color: var(--gold-bright);
    font-weight: 700;
    line-height: 1.05;
    margin: 2px 0;
  }
  .hero-price .pp-meta { font-size: 10px; opacity: 0.9; }
  .hero-meta {
    margin-top: 10px;
    font-size: 9.5px;
    opacity: 0.85;
  }
  .hero-meta strong { color: var(--gold-bright); font-size: 11px; }

  .strip {
    margin-top: 10px;
    background: var(--cream);
    border-radius: 12px;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    overflow: hidden;
  }
  .strip-item {
    padding: 10px 9px;
    border-right: 1px solid #e5ddd0;
  }
  .strip-item:last-child { border-right: none; }
  .strip-item .lbl {
    font-size: 8px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 700;
  }
  .strip-item .val { font-size: 12px; font-weight: 700; margin-top: 3px; color: var(--navy); }
  .strip-item .sub { font-size: 9px; color: var(--muted); margin-top: 2px; line-height: 1.3; }

  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-top: 12px;
  }
  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--navy);
    font-weight: 700;
    margin: 0 0 8px;
  }
  .section-title::before {
    content: "";
    width: 4px;
    height: 14px;
    background: var(--orange-bar);
    border-radius: 2px;
    flex-shrink: 0;
  }
  .hotel-name {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 700;
    color: var(--navy);
  }
  .stars { color: var(--gold); letter-spacing: 1px; margin-left: 4px; }
  .hotel-meta { color: var(--muted); font-size: 9.5px; margin: 4px 0 8px; word-break: break-word; }
  .checks { list-style: none; padding: 0; margin: 0; }
  .checks li {
    padding: 3px 0 3px 16px;
    position: relative;
    font-size: 10px;
    word-break: break-word;
  }
  .checks.ok li::before { content: "✓"; position: absolute; left: 0; color: var(--ok); font-weight: 700; }
  .checks.no li::before { content: "✗"; position: absolute; left: 0; color: var(--no); font-weight: 700; }
  .checks.no { margin-top: 8px; }
  .subhead {
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--navy);
    font-weight: 700;
    margin: 10px 0 6px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .subhead::before {
    content: "";
    width: 4px;
    height: 12px;
    background: var(--orange-bar);
    border-radius: 2px;
  }

  .itinerary { margin-top: 12px; }
  .day { display: flex; gap: 10px; margin-bottom: 8px; align-items: flex-start; }
  .day-badge {
    flex-shrink: 0;
    background: var(--navy);
    color: #fff;
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 5px 8px;
    border-radius: 6px;
    max-width: 118px;
    line-height: 1.25;
  }
  .day-title { font-weight: 700; font-size: 11px; color: var(--navy); margin-bottom: 2px; }
  .day-content { font-size: 9.5px; color: #2a3348; word-break: break-word; }

  .pay-bar {
    margin-top: 10px;
    background: #eef0f4;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 10px;
    color: #2a3348;
  }
  .disclaimer {
    margin-top: 8px;
    background: #fff8e8;
    border: 1px solid #e8d39a;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 9px;
    color: #6a5a28;
  }

  /* Page 2 */
  .p2-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-bottom: 2px solid var(--navy);
    padding-bottom: 8px;
    margin-bottom: 12px;
  }
  .p2-header h1 {
    margin: 0;
    font-size: 18px;
    color: var(--navy);
    letter-spacing: 0.02em;
  }
  .p2-header .sub { font-size: 10px; color: var(--muted); margin-top: 2px; }
  .p2-header .cot { font-size: 10px; color: var(--muted); text-align: right; }

  .exp-group {
    background: var(--cream-soft);
    border-radius: 12px;
    padding: 10px 12px;
    margin-bottom: 12px;
  }
  .exp-group-title {
    font-size: 9px;
    letter-spacing: 0.12em;
    font-weight: 700;
    color: var(--navy);
    margin-bottom: 8px;
  }
  .exp-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 7px 0;
    border-bottom: 1px solid var(--line);
  }
  .exp-row:last-child { border-bottom: none; }
  .exp-name { font-weight: 700; font-size: 11px; color: var(--navy); }
  .exp-detail { font-size: 9.5px; color: var(--muted); margin-top: 2px; }
  .exp-price { font-weight: 700; white-space: nowrap; color: var(--navy); font-size: 11px; }

  .upsell-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }
  .upsell-card {
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 10px;
    background: #fff;
    min-height: 132px;
  }
  .upsell-emoji { font-size: 18px; }
  .upsell-price { color: var(--gold); font-weight: 700; font-size: 13px; margin: 4px 0; }
  .upsell-title { font-weight: 700; font-size: 11px; color: var(--navy); margin-bottom: 4px; word-break: break-word; }
  .upsell-body { font-size: 9px; color: var(--muted); word-break: break-word; }
  .upsell-badge { font-size: 8.5px; color: var(--ok); margin-top: 6px; font-weight: 600; }

  .tips-grid, .pack-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }
  .tip-card, .pack-card {
    background: var(--cream-soft);
    border-radius: 10px;
    padding: 9px 10px;
  }
  .tip-card .t, .pack-card .t { font-weight: 700; font-size: 10.5px; color: var(--navy); margin: 2px 0 4px; }
  .tip-card .b, .pack-card .b { font-size: 9px; color: var(--muted); word-break: break-word; }

  .gastro-list { margin-bottom: 12px; }
  .gastro-item {
    display: grid;
    grid-template-columns: 22px 1fr auto;
    gap: 8px;
    padding: 7px 0;
    border-bottom: 1px solid var(--line);
    align-items: start;
  }
  .gastro-item:last-child { border-bottom: none; }
  .gastro-name { font-weight: 700; color: var(--navy); font-size: 11px; }
  .gastro-body { font-size: 9.5px; color: var(--muted); word-break: break-word; }
  .gastro-link { font-size: 9px; color: var(--gold); white-space: nowrap; text-decoration: none; }

  .climate-box {
    display: grid;
    grid-template-columns: 110px 1fr;
    gap: 12px;
    background: var(--cream);
    border-radius: 12px;
    padding: 12px;
    margin-bottom: 12px;
  }
  .climate-badge {
    background: var(--navy);
    color: #fff;
    border-radius: 10px;
    padding: 10px;
    text-align: center;
  }
  .climate-badge .s { font-size: 9px; letter-spacing: 0.12em; font-weight: 700; }
  .climate-badge .r { font-size: 16px; font-weight: 700; margin-top: 4px; color: var(--gold-bright); }
  .climate-body { font-size: 9.5px; color: #2a3348; word-break: break-word; }

  .footer-bar {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    background: var(--navy);
    color: #fff;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 11mm;
    font-size: 9px;
  }
  .footer-bar img { height: 18px; filter: brightness(0) invert(1); }

  /* Page 3 */
  .p3-header {
    background: var(--navy);
    color: #fff;
    border-radius: 12px;
    padding: 12px 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 14px;
  }
  .p3-header .brand-line { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 700; }
  .p3-header .meta { font-size: 9px; opacity: 0.85; text-align: right; }

  .map-layout {
    display: grid;
    grid-template-columns: 1.1fr 0.9fr;
    gap: 14px;
    margin-bottom: 16px;
  }
  .map-summary { font-size: 11px; color: #2a3348; line-height: 1.55; word-break: break-word; }
  .map-card { text-decoration: none; color: inherit; display: block; }
  .map-canvas {
    position: relative;
    height: 180px;
    border-radius: 14px;
    overflow: hidden;
    background: linear-gradient(160deg, #cfe6f5 0%, #b7d8ec 40%, #9ec9e0 100%);
    border: 1px solid #c5d8e6;
  }
  .map-land {
    position: absolute;
    border-radius: 40% 45% 48% 42%;
    opacity: 0.92;
  }
  .map-br { width: 52%; height: 70%; right: 4%; top: 8%; background: #7fad6a; }
  .map-py { width: 34%; height: 42%; left: 6%; top: 10%; background: #8fb56f; }
  .map-ar { width: 48%; height: 55%; left: 18%; bottom: 4%; background: #6f9d5c; }
  .map-water {
    position: absolute;
    left: 38%; top: 28%;
    width: 28%; height: 36%;
    background: radial-gradient(circle at 40% 40%, #5ba3c9 0%, #3d87b0 70%);
    border-radius: 50% 40% 55% 45%;
    opacity: 0.85;
  }
  .map-pin { position: absolute; left: 48%; top: 46%; transform: translate(-50%, -100%); text-align: center; }
  .map-pin-dot {
    display: block;
    width: 14px; height: 14px;
    margin: 0 auto 4px;
    background: #c0392b;
    border: 2px solid #fff;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    box-shadow: 0 2px 6px rgba(0,0,0,0.25);
  }
  .map-pin-label {
    display: inline-block;
    background: #fff;
    color: var(--navy);
    font-size: 9px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
  }
  .map-label { position: absolute; font-size: 8px; font-weight: 700; color: #35553a; opacity: 0.8; }
  .map-label-br { right: 10%; top: 14%; }
  .map-label-py { left: 10%; top: 16%; }
  .map-label-ar { left: 28%; bottom: 10%; }
  .map-caption { margin-top: 6px; font-size: 9px; color: var(--muted); }

  .cta-box {
    background: var(--cream);
    border-radius: 14px;
    padding: 16px;
    margin-bottom: 14px;
  }
  .cta-box h2 { margin: 0 0 6px; font-size: 14px; color: var(--navy); }
  .cta-box p { margin: 0 0 10px; font-size: 11px; color: #2a3348; }
  .btn {
    display: inline-block;
    background: var(--gold);
    color: var(--navy-deep);
    font-weight: 700;
    text-decoration: none;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 11px;
  }

  .contact-box {
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 14px 16px;
  }
  .contact-box h3 {
    margin: 0 0 8px;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--navy);
  }
  .contact-box .line { font-size: 11px; margin: 4px 0; word-break: break-word; }
  .contact-box .brand-line { font-weight: 700; color: var(--navy); margin-top: 8px; }

  .muted { color: var(--muted); }
  .page-pad-bottom { padding-bottom: 18mm; }
</style>
</head>
<body>
  <section class="page">
    <div class="hero">
      <div>
        <img class="hero-logo" src="${logo}" alt="${escapeHtml(brandName)}" />
        <p class="hero-hello">Hola, ${escapeHtml(firstName(form.clienteNombre))} — tu propuesta está lista 🎉</p>
        <div class="${heroDestClass}">${escapeHtml(destino.toUpperCase())}</div>
        <div class="hero-loc">📍 ${escapeHtml(locationLabel)}</div>
        <div class="tags">
          ${tags
            .map(
              (t) =>
                `<span class="tag${t.accent ? " accent" : ""}">${t.emoji} ${escapeHtml(t.label)}</span>`,
            )
            .join("")}
        </div>
      </div>
      <div class="hero-price">
        <div class="pp-label">Total por persona</div>
        <div class="pp-value">USD ${money(result.precioAdultoCliente)}</div>
        <div class="pp-meta">${escapeHtml(paxLabel)}</div>
        <div class="pp-meta">${escapeHtml(form.metodoPago.charAt(0).toUpperCase() + form.metodoPago.slice(1))} · ${feeLabel}</div>
        <div class="hero-meta">
          <strong>${escapeHtml(cotNumber)}</strong><br/>
          ${escapeHtml(formatDateEs(generatedAt))} · válida hasta ${escapeHtml(formatDateEs(validUntil))}
        </div>
      </div>
    </div>

    <div class="strip">
      <div class="strip-item">
        <div class="lbl">Salida</div>
        <div class="val">${escapeHtml(formatDateShortMonth(form.fechaIda))}</div>
        <div class="sub">${escapeHtml(weekdayLongEs(form.fechaIda))}</div>
      </div>
      <div class="strip-item">
        <div class="lbl">Regreso</div>
        <div class="val">${escapeHtml(formatDateShortMonth(form.fechaVuelta))}</div>
        <div class="sub">${escapeHtml(weekdayLongEs(form.fechaVuelta))}</div>
      </div>
      <div class="strip-item">
        <div class="lbl">Pasajeros</div>
        <div class="val">${escapeHtml(paxLabel)}</div>
        ${agesLabel ? `<div class="sub">${escapeHtml(agesLabel)}</div>` : ""}
      </div>
      <div class="strip-item">
        <div class="lbl">Alojamiento</div>
        <div class="val">${escapeHtml(nightsLabel(form.fechaIda, form.fechaVuelta))}</div>
        <div class="sub">${escapeHtml(stripHotelSub)}</div>
      </div>
      <div class="strip-item">
        <div class="lbl">Total general</div>
        <div class="val">USD ${money(result.precioFinalCliente)}</div>
        <div class="sub">USD ${money(result.precioAdultoCliente)} / pax · ${totalPax} pax · ${escapeHtml(destino)}</div>
      </div>
    </div>

    ${flightsHtml}

    <div class="two-col">
      <div>
        <h2 class="section-title">Alojamiento</h2>
        ${hotelsHtml}
      </div>
      <div>
        <h2 class="section-title">¿Qué incluye?</h2>
        <ul class="checks ok">
          ${includes.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}
        </ul>
        <div class="subhead">¿Qué no incluye?</div>
        <ul class="checks no">
          ${excludes.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}
        </ul>
      </div>
    </div>

    <div class="itinerary">
      <h2 class="section-title">Itinerario día a día</h2>
      ${itineraryHtml(form.itinerario || "")}
    </div>

    <div class="pay-bar">💳 ${escapeHtml(paymentFooterLine(form.metodoPago))}</div>
    <div class="disclaimer">
      ⚠ Cotización válida hasta el ${escapeHtml(formatDateEs(validUntil))}.
      Precios en USD sujetos a disponibilidad al tipo de cambio del día.
      Cambios de fechas o ruta pueden generar diferencias. Documento confidencial.
    </div>
  </section>

  <section class="page page-pad-bottom">
    <div class="p2-header">
      <div>
        <h1>Guía del Destino — ${escapeHtml(destino.toUpperCase())}</h1>
        <div class="sub">${escapeHtml(guideSubtitle)}</div>
      </div>
      <div class="cot">${escapeHtml(cotNumber)} · Pág. 2 de ${pageCount}</div>
    </div>

    <h2 class="section-title">Experiencias incluidas</h2>
    ${experiencesHtml}

    <h2 class="section-title">Excursiones disponibles</h2>
    ${upsellHtml || `<p class="muted">Consultá upsells disponibles con tu asesor.</p>`}

    ${isMulti ? "" : editorialSectionsHtml}

    <div class="footer-bar">
      <span><img src="${logo}" alt="" /> ${escapeHtml(brandName)}</span>
      <span>${escapeHtml(footer.whatsapp.replaceAll("-", " "))}</span>
    </div>
  </section>

  ${
    isMulti
      ? `<section class="page page-pad-bottom">
    <div class="p2-header">
      <div>
        <h1>Tips y clima — ${escapeHtml(destino.toUpperCase())}</h1>
        <div class="sub">${escapeHtml(guideSubtitle)}</div>
      </div>
      <div class="cot">${escapeHtml(cotNumber)} · Pág. 3 de ${pageCount}</div>
    </div>
    ${editorialSectionsHtml}
    <div class="footer-bar">
      <span><img src="${logo}" alt="" /> ${escapeHtml(brandName)}</span>
      <span>${escapeHtml(footer.whatsapp.replaceAll("-", " "))}</span>
    </div>
  </section>`
      : ""
  }

  <section class="page page-pad-bottom">
    <div class="p3-header">
      <div>
        <div class="brand-line">${escapeHtml(brandName)}</div>
        <div style="font-size:10px;opacity:.85;margin-top:2px">Guía + Asesoría · ${escapeHtml(destino.toUpperCase())}</div>
      </div>
      <div class="meta">
        Documento confidencial<br/>
        ${escapeHtml(cotNumber)} · Pág. ${pageCount} de ${pageCount}
      </div>
    </div>

    ${mapsSectionHtml}

    <div class="cta-box">
      <h2>¿Querés una asesoría personalizada?</h2>
      <p>Agendá una videollamada con un asesor Madero (15–20 minutos, sin costo). Ajustamos detalles, resolvemos dudas y aseguramos la mejor experiencia para tu viaje.</p>
      <a class="btn" href="${escapeHtml(footer.calendly)}">📅 Reservar reunión Meet → ${escapeHtml(footer.calendly)}</a>
    </div>

    <div class="contact-box">
      <h3>Contacto directo</h3>
      <div class="line">💬 WhatsApp: ${escapeHtml(footer.whatsapp)}</div>
      <div class="line">✉ ${escapeHtml(footer.email)}</div>
      <div class="brand-line">${escapeHtml(brandName)} · EVT ${escapeHtml(footer.evt)} · ${escapeHtml(footer.city)}</div>
    </div>

    <div class="footer-bar">
      <span><img src="${logo}" alt="" /> ${escapeHtml(brandName)}</span>
      <span>${escapeHtml(footer.whatsapp)} · ${escapeHtml(footer.email)}</span>
    </div>
  </section>
</body>
</html>`;
}
