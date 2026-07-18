import type { PdfDestinationCopy } from "@/data/pdf-copy/types";

/**
 * Copy editorial para PDF cliente — Iguazú.
 * Tips / gastro / mapa: Tips & Gastro CSV + Mapas Destinos CSV.
 * Exclusiones y highlights: genéricos del destino (sin datos de un caso/lead).
 */
export const iguazuPdfCopy: PdfDestinationCopy = {
  locationLabel: "Puerto Iguazú, Misiones · Argentina",
  defaultTags: [
    { emoji: "🎖", label: "Paquete premium", accent: true },
    { emoji: "👨‍👩‍👧‍👦", label: "Familia" },
    { emoji: "💧", label: "Cataratas UNESCO" },
    { emoji: "🌳", label: "Hotel de selva" },
  ],
  guideSubtitle: ({ perfil, seasonHint }) =>
    `Iguazú · ${seasonHint} · ${perfil.toLowerCase()}`,
  excludes: [
    "Vuelos internacionales no incluidos · el cliente gestiona por su cuenta salvo indicación expresa",
    "Transfers en ciudad de origen o conexión (fuera de Iguazú) no incluidos salvo indicación expresa",
    "Alojamiento fuera de Puerto Iguazú / Foz no incluido",
    "Equipaje despachado si la tarifa aérea no lo incluye — add-on a cargo del cliente con la aerolínea",
    "Ingreso al PN Iguazú (lado argentino), PN do Iguaçu (lado brasileño) y Parque de las Aves — tarifas vigentes al día de la visita",
    "Almuerzos, cenas, bebidas, gastos personales",
  ],
  hotelHighlights: [
    "Hotel boutique de selva · piscina rodeada de selva · entorno natural privilegiado",
    "Ideal para familias · entorno natural y tranquilo",
    "Cerca de Cataratas + Triple Frontera",
  ],
  upsells: [
    {
      emoji: "🚤",
      title: "Gran Aventura — paseo en lancha bajo cataratas",
      body: "Lancha rápida que se mete bajo el salón de las cataratas. ⚠ Niños mín. 12 años — solo aplica adultos.",
      priceUsd: 85,
      badge: "✓ Equipo impermeable · botas",
    },
    {
      emoji: "🚁",
      title: "Helicóptero sobre cataratas (Brasil)",
      body: "Vuelo panorámico de 10 minutos sobre la Garganta del Diablo. Sale de Foz do Iguaçu lado brasileño.",
      priceUsd: 180,
      badge: "✓ Sin restricción edad · familia OK",
    },
    {
      emoji: "🌳",
      title: "Selva Iryapú con guía bilingüe",
      body: "Caminata 2-3 hrs por la selva paranaense con interpretación de flora y fauna. Familiar y educativo.",
      priceUsd: 28,
      badge: "✓ Guía + agua mineral",
    },
  ],
  tips: [
    {
      emoji: "🦟",
      title: "Repelente de mosquitos imprescindible",
      body: "Iguazú es selva subtropical. Llevar repelente con DEET 25%+ y aplicar generosamente. Mosquitos peor al amanecer/atardecer.",
    },
    {
      emoji: "👟",
      title: "Calzado cerrado antideslizante",
      body: "Las pasarelas del PN Iguazú están húmedas constantemente. Calzado deportivo con buena suela para niños y adultos.",
    },
    {
      emoji: "💧",
      title: "Vestimenta de cambio para Garganta del Diablo",
      body: "La nube de la Garganta moja TODO. Llevar muda completa o impermeable para niños. En invierno hace algo de frío al mojarse.",
    },
  ],
  gastro: [
    {
      emoji: "🥩",
      name: "La Rueda 1975 — parrilla emblemática Iguazú",
      body: "Parrilla de carnes argentinas + opciones para niños. A 5 min del centro · ambiente familiar.",
      mapsQuery: "La+Rueda+1975+Puerto+Iguazu+Argentina",
    },
    {
      emoji: "🍕",
      name: "Aqva Restaurant — cocina regional",
      body: "Pescados de río (surubí, dorado) + opciones internacionales. Vista al río Paraná. Reservar.",
      mapsQuery: "Aqva+Restaurant+Puerto+Iguazu",
    },
    {
      emoji: "🍦",
      name: "Heladería Don Pablo",
      body: "Heladería artesanal · imperdible chocolate + helado de mate cocido. Niños adoran.",
      mapsQuery: "Heladeria+Don+Pablo+Iguazu",
    },
  ],
  climate: {
    season: "INVIERNO",
    range: "13°C a 22°C",
    body: "Julio en Iguazú es uno de los mejores meses para visitar: temperaturas templadas (no calor extremo), menos humedad, menos mosquitos que en verano. Posibles días lluviosos (llevar impermeable). Garganta del Diablo se siente fresca con la nube de agua. Recomendable manga larga liviana + impermeable.",
  },
  packingTitle: "Qué llevar — Iguazú invierno familiar",
  packing: [
    {
      emoji: "🦟",
      title: "Repelente DEET 25%+",
      body: "Imprescindible para selva subtropical · 1 frasco por adulto + 1 spray amistoso niños.",
    },
    {
      emoji: "👟",
      title: "Calzado cerrado antideslizante",
      body: "Pasarelas siempre húmedas. Zapatillas deportivas con buena suela para todos.",
    },
    {
      emoji: "☔",
      title: "Impermeable + muda",
      body: "Garganta del Diablo moja. Capa impermeable liviana + muda completa por pax (niños indispensable).",
    },
  ],
  map: {
    summary:
      "Puerto Iguazú, Misiones, frontera con Brasil y Paraguay. A 1.300 km de Buenos Aires (1h 50min de vuelo). Cataratas del Iguazú (UNESCO), selva subtropical y Triple Frontera.",
    lat: -25.5985,
    lng: -54.5723,
    pinLabel: "Puerto Iguazú",
  },
};
