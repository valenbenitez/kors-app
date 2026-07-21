# PDF cliente — fuentes de contenido

Inventario de bloques del PDF generado por `renderPdfHtml`. Clasificación:

| Clase | Significado |
|-------|-------------|
| **A** | Dato del formulario |
| **B** | Derivado del cálculo / catálogo |
| **C** | Copy editorial por destino (`src/data/pdf-copy/`) |
| **D** | Hardcodeado / placeholder — eliminar o reemplazar |

Overrides opcionales (`includes`, `excludes`, `hotelHighlights`, `tags`, `experiencePricesUsd`, etc.) existen solo para fixtures/tests. `POST /api/generate-pdf` pasa únicamente `{ cotNumber, form, result, generatedAt }`.

**Modo:** `form.destinos.length === 1` → single (3 páginas). `form.destinos.length >= 2` → multi (4 páginas; P3 tips/clima densos, P4 mapas + CTA).

## Página 1 — Propuesta

| Bloque | Clase | Fuente |
|--------|-------|--------|
| Saludo / nombre cliente | A | `form.clienteNombre` |
| Destino (título) | A | single: `destinos[0]`; multi: nombres unidos con ` + ` |
| Ubicación (subtítulo) | C | `copy.locationLabel` (multi: join de cada destino) |
| Tags | C (+ A) | `copy.defaultTags`; “Familia N pax” usa total pax del form |
| Precio por persona / total | B | `result.precioAdultoCliente`, `result.precioFinalCliente` |
| Método de pago + fee | A + B | `form.metodoPago` + `feeMultiplierLabel` |
| Nº cotización / fechas validez | A + B | `cotNumber`, `generatedAt`, `validUntil` (o +7 días) |
| Strip: salida / regreso | A | `form.fechaIda`, `form.fechaVuelta` |
| Strip: pasajeros / edades | A | `paxAdultos`, `paxMenores`, `edadesMenores` |
| Strip: alojamiento (noches + hotel) | A + B | fechas → noches; hotel(es) — multi lista nombres |
| **Vuelos (sección dedicada)** | A | `aerolinea` + `vueloIda*` / `vueloVuelta*`; omitida si todos los costos de vuelo = 0 (§6.7) |
| Hotel nombre / meta | A | loop de `form.destinos` (multi: un bloque por destino) |
| Hotel highlights | C + A | `copy.hotelHighlights` + ubicación / `hotelAjusteRazon` del form |
| ¿Qué incluye? | A + B | vuelos/hotel/excursiones de **todos** los destinos + **equipaje** (§6.8) si hay vuelos |
| ¿Qué no incluye? | C + A | `copy.excludes` de cada destino + `hotelExcluye` |
| Itinerario | A | `form.itinerario` |
| Forma de pago (footer) | A | `paymentFooterLine(metodoPago)` |
| Disclaimer validez | B | `validUntil` |

## Página 2 — Guía / experiencias

| Bloque | Clase | Fuente |
|--------|-------|--------|
| Título guía + subtítulo | A + C | destino(s) + `copy.guideSubtitle` |
| Experiencias incluidas | B | catálogo agrupado **por destino** |
| Upsells | C | `copy.upsells` (unión dedupe; vacío → mensaje asesor) |
| Tips / gastro / clima / packing | C | solo en single en P2; **omitidos si arrays vacíos** |

## Página 3 — Single: mapa + CTA · Multi: tips/clima

| Bloque | Clase | Fuente |
|--------|-------|--------|
| (single) Resumen / mapa / pin | C | `copy.map` (coords 0,0 → fallback) |
| (single) CTA / contacto | fijo | `CONTACT` en `format.ts` |
| (multi) Tips / gastro / clima / packing | C | por cada destino; omitir bloques vacíos |

## Página 4 — Solo multi: mapas + CTA

| Bloque | Clase | Fuente |
|--------|-------|--------|
| Mapas por destino | C | un bloque por `form.destinos` |
| CTA Calendly / contacto | fijo producto | `CONTACT` en `format.ts` |

## Qué era (D) y se corrigió

| Ítem | Antes | Después |
|------|-------|---------|
| `iguazu.excludes` | Rutas Lima↔BUE, LATAM 2445, JetSMART, Mar 28 / Vie 31 | Exclusiones genéricas de Iguazú |
| `iguazu.hotelHighlights` | “descuento aplicado sobre tarifa rack” del caso | Highlights genéricos de selva |
| Detalle experiencias en template | “día completo PN Iguazú” / copy caso | Solo proveedor / neutro |
| Nombres excursión | Mappings mezclados con caso | `nombreLimpio` + alias de **producto** de catálogo |
| Multi-destino | Solo `destinos[0]` | Branch multi: título, hoteles, experiencias, includes |
| Vuelos / equipaje | Solo bullets genéricos | Sección vuelos + línea equipaje §6.8 |

## Regla de oro

Si el form no tiene un dato (cliente, hotel, fechas, aerolínea, ruta), el PDF **no** debe rellenarlo con el ejemplo Krystel / COT-0010. Copy (C) es editorial del **destino**, nunca del lead.
