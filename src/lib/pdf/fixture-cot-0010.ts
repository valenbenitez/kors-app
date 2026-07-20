import { formToFormulaInput } from "@/lib/cotizador/build-input";
import { calcularCotizacion } from "@/lib/cotizador/formula";
import { fallbackFxRates } from "@/lib/cotizador/rates";
import type { PdfRenderData } from "@/lib/pdf/template";
import {
  type CotizacionFormInput,
  emptyDestino,
} from "@/lib/validations/cotizacion";

/**
 * Fixture reproducible COT-0010 (Krystel · Iguazú · ref docs/mvp/COT-0010_cliente.pdf).
 *
 * Validez: la ref muestra “válida hasta 29 jun 2026” (+2 días desde 27 jun).
 * El runtime usa `VALIDEZ_COTIZACION_DIAS` (7). Este fixture fija `validUntil`
 * a la fecha de la ref para matching visual de snapshots.
 *
 * Overrides (`includes`, `excludes`, `hotelHighlights`, `tags`,
 * `experiencePricesUsd`, `guideSubtitle`) son **solo para tests/snapshots**.
 * `POST /api/generate-pdf` nunca los envía — el template usa form + catálogo +
 * copy editorial genérico del destino.
 */
export const COT_0010_INCLUDES = [
  "2 vuelos JetSMART cabotaje EZE-IGR-EZE (ida + vuelta) con tasas",
  "Yvy Hotel de Selva 4★ Puerto Iguazú · 3 noches con desayuno · 2 habitaciones Twin Estándar para 7 pax",
  "PQT 01A — Transfer in/out hotel Iguazú + Cataratas Argentinas (PN Iguazú lado ARG)",
  "Excursión Cataratas Brasileras (PN do Iguaçu lado BRA) + Parque de las Aves",
  "Asistencia al viajero básica",
] as const;

export const COT_0010_EXCLUDES = [
  "Vuelos internacionales Lima ↔ Buenos Aires NO incluidos · cliente gestiona por su cuenta (referencia LATAM 2445/2464 · USD ~730/pax)",
  "Transfers en Buenos Aires NO incluidos · cliente coordina AEP↔EZE entre vuelo internacional y JetSMART (~USD 30-50/pax · Tienda León / remis privado)",
  "Alojamiento en Buenos Aires NO incluido · cliente decide si necesita hotel tránsito Mar 28 (día libre BUE) o Vie 31 (post arribo EZE)",
  "JetSMART NO incluye valija despachada · tarifa Economy J/Q Basic — cliente compra add-on en web (~USD 25-40/tramo/pax) o usa solo carry-on",
  "Ingreso al PN Iguazú (Arg ARS ~30.000 ad + ARS 6.000 menor 6-12) · al PN Brasil (BRL ~120/ad · 50% menor) · entrada Parque de Aves (BRL ~70 ad / 50% menor)",
  "Almuerzos, cenas, bebidas, gastos personales",
] as const;

export const COT_0010_ITINERARIO = `Día 1 · Mar 28 Jul: Buenos Aires → Iguazú (vuelo nocturno)
Tarde libre en Buenos Aires. Traslado al aeropuerto EZE (cliente coordina). JetSMART 3150 EZE-IGR 20:58 → 22:52. Llegada nocturna a Puerto Iguazú · transfer al Yvy Hotel de Selva (incluido en PQT 01A). Check-in tardío + descanso.

Día 2 · Mié 29 Jul: Cataratas Argentinas (PN Iguazú)
Día completo. PQT 01A · Transfer al Parque Nacional Iguazú · circuitos Superior, Inferior, Garganta del Diablo (Tren Ecológico de la Selva). Almuerzo libre en el parque. Regreso al hotel · tarde en la piscina de selva.

Día 3 · Jue 30 Jul: Cataratas Brasileras + Parque de las Aves
Día completo lado brasileño. Cruce de frontera Argentina-Brasil. Vista panorámica de las cataratas + paseo elevado sobre la Garganta. Continuación al Parque de las Aves (tucanes, guacamayos, colibríes en hábitat natural). Ideal para los niños. Regreso al hotel.

Día 4 · Vie 31 Jul: Iguazú → Buenos Aires
Check-out hotel temprano. Transfer al aeropuerto IGR (incluido). JetSMART 3151 IGR-EZE 08:54 → 10:54. Llegada Buenos Aires (EZE) al mediodía. Fin del programa Madero Viagens · cliente continúa con sus vuelos internacionales por cuenta propia.`;

export function buildCot0010Form(): CotizacionFormInput {
  const flightArs = 233.9 * 1420;
  const hotelArs = 1_277_794 / 7;

  return {
    clienteNombre: "Krystel",
    paisOrigen: "Perú",
    whatsapp: "+51999958694",
    perfil: "Familia con niños",
    destinosSeleccionados: ["Misiones"],
    fechaIda: "2026-07-28",
    fechaVuelta: "2026-07-31",
    paxAdultos: 5,
    paxMenores: 2,
    edadesMenores: [6, 7],
    metodoPago: "tarjeta",
    equipaje: "carry-on",
    aerolinea: "JetSMART",
    vueloIdaFecha: "",
    vueloIdaHoraSalida: "",
    vueloIdaHoraLlegada: "",
    vueloIdaNumero: "",
    vueloIdaAeropuertoSalida: "",
    vueloIdaAeropuertoLlegada: "",
    vueloVueltaFecha: "",
    vueloVueltaHoraSalida: "",
    vueloVueltaHoraLlegada: "",
    vueloVueltaNumero: "",
    vueloVueltaAeropuertoSalida: "",
    vueloVueltaAeropuertoLlegada: "",
    itinerario: COT_0010_ITINERARIO,
    destinos: [
      {
        ...emptyDestino("Misiones"),
        vueloIdaAdultoArs: flightArs,
        vueloIdaMenorArs: flightArs,
        hotelAdultoArs: hotelArs,
        hotelMenorArs: hotelArs,
        hotelNombre: "Yvy Hotel de Selva",
        hotelCategoria: "4★",
        hotelRegimen: "desayuno incluido",
        hotelUbicacion: "2.32 km del centro",
        hotelHabitacion: "2 × habitación Twin Estándar",
        hotelAjusteRazon: "descuento -31% aplicado (ARS 1.857.065 → 1.277.794)",
        // IDs del catálogo con nombres restaurados; netos del fixture
        // coinciden con la reconstrucción ARS de la fórmula (48.200 / 65.600).
        excursionIds: ["exc-3", "exc-10"],
      },
    ],
  };
}

export function buildCot0010PdfData(): PdfRenderData {
  const form = buildCot0010Form();
  const rates = fallbackFxRates();
  const result = calcularCotizacion({
    ...formToFormulaInput(form, rates),
    tcArsUsd: 1420,
  });

  return {
    cotNumber: "COT-0010",
    form,
    result,
    generatedAt: "2026-06-27",
    validUntil: "2026-06-29",
    includes: [...COT_0010_INCLUDES],
    excludes: [...COT_0010_EXCLUDES],
    hotelHighlights: [
      "Hotel boutique de selva · piscina rodeada de selva · entorno natural privilegiado",
      "7 pax distribuidos en 2 habitaciones · ideal familia · descuento -31% aplicado (ARS 1.857.065 → 1.277.794)",
      "A 2.32 km del centro de Puerto Iguazú · cerca de Cataratas + Triple Frontera",
    ],
    tags: [
      { emoji: "🎖", label: "Paquete premium", accent: true },
      { emoji: "👨‍👩‍👧‍👦", label: "Familia 7 pax" },
      { emoji: "💧", label: "Cataratas UNESCO" },
      { emoji: "🌳", label: "Hotel de selva 4★" },
    ],
    guideSubtitle: "Iguazú · invierno familia · fiestas patrias Perú 2026",
    experiencePricesUsd: {
      "exc-3": 34,
      "exc-10": 47,
    },
  };
}
