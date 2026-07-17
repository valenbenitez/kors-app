import { catalog } from "@/lib/cotizador/catalog";
import {
  addDaysIso,
  CONTACT,
  formatDateEs,
  formatDateShort,
  IATA_BY_DESTINO,
  nightsLabel,
  ORIGIN_IATA,
  paymentMethodDesc,
  VALIDEZ_COTIZACION_DIAS,
} from "@/lib/cotizador/format";
import type { FormulaResult } from "@/lib/cotizador/formula";
import type { CotizacionFormInput } from "@/lib/validations/cotizacion";

export type PdfRenderData = {
  cotNumber: string;
  form: CotizacionFormInput;
  result: FormulaResult;
  generatedAt: string;
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

function moneyDec(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function itineraryHtml(text: string): string {
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(Día \d+):\s*(.*)$/i);
      if (!match) {
        return `<div class="day"><div class="day-content">${escapeHtml(line)}</div></div>`;
      }
      return `<div class="day"><div class="day-num">${escapeHtml(match[1])}</div><div class="day-content">${escapeHtml(match[2])}</div></div>`;
    })
    .join("");
}

function includesList(form: CotizacionFormInput): string[] {
  const items: string[] = [];
  const dest = form.destinos[0];
  if (!dest) return items;

  const hasFlights =
    dest.vueloIdaAdultoArs +
      dest.vueloIdaMenorArs +
      dest.vueloVueltaAdultoArs +
      dest.vueloVueltaMenorArs >
    0;

  if (hasFlights) {
    const airline = form.aerolinea?.trim() || "Aerolínea a confirmar";
    const iata = IATA_BY_DESTINO[dest.destino] ?? "???";
    items.push(
      `Vuelos ${airline} ${ORIGIN_IATA}-${iata}-${ORIGIN_IATA} (ida + vuelta)`,
    );
  }

  if (dest.hotelAdultoArs + dest.hotelMenorArs > 0) {
    const name = dest.hotelNombre || "Hotel";
    const cat = dest.hotelCategoria ? ` ${dest.hotelCategoria}` : "";
    items.push(
      `${name}${cat} · ${nightsLabel(form.fechaIda, form.fechaVuelta)}${dest.hotelRegimen ? ` · ${dest.hotelRegimen}` : ""}`,
    );
  }

  for (const id of dest.excursionIds) {
    const exc = catalog.find((e) => e.id === id);
    if (exc) items.push(exc.nombreLimpio);
  }

  items.push("Asistencia al viajero básica");
  items.push(`Equipaje: ${form.equipaje}`);
  return items;
}

/**
 * Template MVP inspirado en COT-0010 (3 páginas A4).
 * Placeholders de tips/mapa/clima hasta recibir DBs.
 */
export function renderPdfHtml(data: PdfRenderData): string {
  const { cotNumber, form, result, generatedAt } = data;
  const dest = form.destinos[0];
  const destino = dest?.destino ?? form.destinosSeleccionados[0] ?? "";
  const validUntil = addDaysIso(generatedAt, VALIDEZ_COTIZACION_DIAS);
  const totalPax = form.paxAdultos + form.paxMenores;
  const paxLabel =
    form.paxMenores > 0
      ? `${form.paxAdultos} adultos + ${form.paxMenores} ${form.paxMenores === 1 ? "niño" : "niños"}`
      : `${form.paxAdultos} ${form.paxAdultos === 1 ? "adulto" : "adultos"}`;

  const includes = includesList(form);
  const iata = IATA_BY_DESTINO[destino] ?? "???";
  const airline = form.aerolinea?.trim() || "Aerolínea a confirmar";

  const excursionRows = (dest?.excursionIds ?? [])
    .map((id) => catalog.find((e) => e.id === id))
    .flatMap((exc) => {
      if (!exc) return [];
      const usd =
        exc.moneda === "USD"
          ? exc.neto
          : Number((exc.neto / result.tcArsUsd).toFixed(0));
      return [
        `<tr><td>${escapeHtml(exc.nombreLimpio)} · ${escapeHtml(exc.proveedor || "—")}</td><td class="num">USD ${money(usd)} / pax</td></tr>`,
      ];
    })
    .join("");

  const hotelBlock =
    dest && dest.hotelAdultoArs + dest.hotelMenorArs > 0
      ? `
      <section class="block">
        <h2>Alojamiento</h2>
        <div class="hotel">
          <div class="hotel-title">${escapeHtml(dest.hotelNombre || "Hotel")} <span class="stars">${starsLabel(dest.hotelCategoria || undefined)}</span></div>
          <div class="muted">${escapeHtml(nightsLabel(form.fechaIda, form.fechaVuelta))} · ${escapeHtml(formatDateShort(form.fechaIda))} → ${escapeHtml(formatDateShort(form.fechaVuelta))}${dest.hotelUbicacion ? ` · ${escapeHtml(dest.hotelUbicacion)}` : ""}${dest.hotelHabitacion ? ` · ${escapeHtml(dest.hotelHabitacion)}` : ""}</div>
        </div>
      </section>`
      : "";

  const flightsBlock =
    dest &&
    dest.vueloIdaAdultoArs +
      dest.vueloIdaMenorArs +
      dest.vueloVueltaAdultoArs +
      dest.vueloVueltaMenorArs >
      0
      ? `
      <section class="block">
        <h2>Vuelos</h2>
        <div class="flight-grid">
          <div class="flight-card">
            <div class="label">Vuelo ida</div>
            <div class="route">${ORIGIN_IATA} → ${iata}</div>
            <div class="muted">${escapeHtml(formatDateEs(form.fechaIda))} · ${escapeHtml(airline)}</div>
          </div>
          <div class="flight-card">
            <div class="label">Vuelo vuelta</div>
            <div class="route">${iata} → ${ORIGIN_IATA}</div>
            <div class="muted">${escapeHtml(formatDateEs(form.fechaVuelta))} · ${escapeHtml(airline)}</div>
          </div>
        </div>
      </section>`
      : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(cotNumber)} — ${escapeHtml(form.clienteNombre)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    color: #1a2e28;
    background: #fff;
    font-size: 11px;
    line-height: 1.45;
  }
  .page {
    width: 210mm;
    height: 297mm;
    padding: 14mm 14mm 16mm;
    page-break-after: always;
    position: relative;
    overflow: hidden;
  }
  .page:last-child { page-break-after: auto; }
  .brand {
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #2f6b5a;
    font-weight: 700;
  }
  .hero {
    background: linear-gradient(135deg, #1b3d34 0%, #2f6b5a 55%, #4a8f78 100%);
    color: #fff;
    border-radius: 18px;
    padding: 22px 24px;
    margin-top: 10px;
  }
  .hero h1 {
    margin: 8px 0 4px;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .hero .sub { opacity: 0.9; font-size: 12px; }
  .price-row {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    margin-top: 18px;
  }
  .price-box {
    background: rgba(255,255,255,0.12);
    border-radius: 14px;
    padding: 12px 14px;
    min-width: 140px;
  }
  .price-box .label { font-size: 10px; opacity: 0.85; text-transform: uppercase; letter-spacing: 0.08em; }
  .price-box .value { font-size: 26px; font-weight: 700; margin-top: 2px; }
  .price-box .hint { font-size: 10px; opacity: 0.85; margin-top: 2px; }
  .meta {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-top: 14px;
  }
  .meta-item {
    background: #f3f7f5;
    border-radius: 12px;
    padding: 10px 12px;
  }
  .meta-item .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #5a736a; }
  .meta-item .value { font-size: 12px; font-weight: 600; margin-top: 2px; }
  h2 {
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #2f6b5a;
    margin: 18px 0 8px;
  }
  .hotel-title { font-size: 15px; font-weight: 700; }
  .stars { color: #c9a227; letter-spacing: 1px; }
  .muted { color: #5a736a; }
  .includes { list-style: none; padding: 0; margin: 0; }
  .includes li { padding: 4px 0 4px 18px; position: relative; }
  .includes li::before { content: "✓"; position: absolute; left: 0; color: #2f6b5a; font-weight: 700; }
  .day { display: flex; gap: 10px; margin-bottom: 8px; }
  .day-num { min-width: 52px; font-weight: 700; color: #2f6b5a; }
  .day-content { flex: 1; }
  .flight-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .flight-card {
    border: 1px solid #d7e5df;
    border-radius: 12px;
    padding: 12px;
    background: #fafcfb;
  }
  .flight-card .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #5a736a; }
  .flight-card .route { font-size: 16px; font-weight: 700; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 7px 0; border-bottom: 1px solid #e4eee9; }
  td.num { text-align: right; font-weight: 600; white-space: nowrap; }
  .placeholder {
    background: #fff8e8;
    border: 1px dashed #e0c36a;
    border-radius: 12px;
    padding: 12px 14px;
    color: #7a6420;
    font-size: 11px;
  }
  .footer {
    position: absolute;
    left: 14mm;
    right: 14mm;
    bottom: 10mm;
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: #5a736a;
  }
  .contact-box {
    background: #f3f7f5;
    border-radius: 14px;
    padding: 16px;
    margin-top: 12px;
  }
  .btn-like {
    display: inline-block;
    margin-top: 10px;
    background: #2f6b5a;
    color: #fff;
    padding: 8px 12px;
    border-radius: 999px;
    text-decoration: none;
    font-size: 11px;
  }
</style>
</head>
<body>
  <section class="page">
    <div class="brand">${CONTACT.brand}</div>
    <div class="hero">
      <div class="sub">${escapeHtml(cotNumber)} · ${escapeHtml(formatDateEs(generatedAt))} · válida hasta ${escapeHtml(formatDateEs(validUntil))}</div>
      <h1>Hola, ${escapeHtml(form.clienteNombre.split(" ")[0] || form.clienteNombre)} — tu propuesta está lista</h1>
      <div class="sub">${escapeHtml(destino)} · ${escapeHtml(form.perfil)} · ${escapeHtml(paxLabel)}</div>
      <div class="price-row">
        <div class="price-box">
          <div class="label">Total general</div>
          <div class="value">USD ${money(result.precioFinalCliente)}</div>
          <div class="hint">${paymentMethodDesc(form.metodoPago)}</div>
        </div>
        <div class="price-box">
          <div class="label">Por persona</div>
          <div class="value">USD ${money(result.precioAdultoCliente)}</div>
          <div class="hint">${totalPax} pax · ${escapeHtml(destino)}</div>
        </div>
      </div>
    </div>

    <div class="meta">
      <div class="meta-item"><div class="label">Salida</div><div class="value">${escapeHtml(formatDateShort(form.fechaIda))}</div></div>
      <div class="meta-item"><div class="label">Regreso</div><div class="value">${escapeHtml(formatDateShort(form.fechaVuelta))}</div></div>
      <div class="meta-item"><div class="label">Pasajeros</div><div class="value">${escapeHtml(paxLabel)}</div></div>
      <div class="meta-item"><div class="label">Alojamiento</div><div class="value">${escapeHtml(nightsLabel(form.fechaIda, form.fechaVuelta))}</div></div>
    </div>

    ${flightsBlock}
    ${hotelBlock}

    <section class="block">
      <h2>¿Qué incluye?</h2>
      <ul class="includes">
        ${includes.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}
      </ul>
    </section>

    <section class="block">
      <h2>Itinerario día a día</h2>
      ${itineraryHtml(form.itinerario || "")}
    </section>

    <div class="footer">
      <span>${CONTACT.brand}</span>
      <span>${escapeHtml(cotNumber)} · Pág. 1 de 3</span>
    </div>
  </section>

  <section class="page">
    <div class="brand">Guía del destino — ${escapeHtml(destino)}</div>
    <h2>Experiencias incluidas</h2>
    ${
      excursionRows
        ? `<table>${excursionRows}</table>`
        : `<div class="placeholder">Sin excursiones seleccionadas.</div>`
    }

    <h2>Excursiones disponibles (upsell)</h2>
    <div class="placeholder">
      Ranking de upsells pendiente de tags en catálogo. Se completará cuando el founder taggee las excursiones (Gap 7).
    </div>

    <h2>Tips · Gastronomía · Clima · Qué llevar</h2>
    <div class="placeholder">
      Contenido editorial pendiente de DB Tips &amp; Gastro y tabla de clima (32 filas). Placeholder MVP.
    </div>

    <h2>Desglose interno (auditoría)</h2>
    <table>
      <tr><td>Costo neto USD</td><td class="num">${moneyDec(result.subtotalUsd)}</td></tr>
      <tr><td>Margen agencia USD</td><td class="num">${moneyDec(result.margenAgenciaUsd)}</td></tr>
      <tr><td>Post fee (${escapeHtml(form.metodoPago)})</td><td class="num">${moneyDec(result.precioPostFee)}</td></tr>
      <tr><td>Margen vendedor USD</td><td class="num">${moneyDec(result.margenVendedorUsd)}</td></tr>
      <tr><td>Precio final (CEILING)</td><td class="num"><strong>USD ${money(result.precioFinalCliente)}</strong></td></tr>
      <tr><td>TC ARS/USD</td><td class="num">${result.tcArsUsd}</td></tr>
    </table>

    <div class="footer">
      <span>${CONTACT.brand}</span>
      <span>${escapeHtml(cotNumber)} · Pág. 2 de 3</span>
    </div>
  </section>

  <section class="page">
    <div class="brand">${CONTACT.brand} · Guía + Asesoría · ${escapeHtml(destino)}</div>
    <h2>Dónde queda ${escapeHtml(destino)}</h2>
    <div class="placeholder">
      Mapa y summary pendientes de DB Mapas Destinos. Destino cotizado: <strong>${escapeHtml(destino)}</strong>
      ${dest?.hotelUbicacion ? ` · ${escapeHtml(dest.hotelUbicacion)}` : ""}.
    </div>

    <h2>¿Querés una asesoría personalizada?</h2>
    <div class="contact-box">
      <p>Agendá una videollamada con un asesor Madero (15–20 minutos, sin costo).</p>
      <a class="btn-like" href="${CONTACT.calendly}">Reservar reunión → ${CONTACT.calendly}</a>
      <p style="margin-top:14px"><strong>Contacto directo</strong><br/>
      WhatsApp: ${CONTACT.whatsapp}<br/>
      Email: ${CONTACT.email}</p>
    </div>

    <p class="muted" style="margin-top:24px">
      Cotización válida hasta el ${escapeHtml(formatDateEs(validUntil))}.
      Precios en USD sujetos a disponibilidad al tipo de cambio del día.
      Documento confidencial.
    </p>

    <div class="footer">
      <span>${CONTACT.whatsapp} · ${CONTACT.email}</span>
      <span>${escapeHtml(cotNumber)} · Pág. 3 de 3</span>
    </div>
  </section>
</body>
</html>`;
}
