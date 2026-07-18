# PDF cliente — fuentes de contenido

Inventario de bloques del PDF generado por `renderPdfHtml`. Clasificación:

| Clase | Significado |
|-------|-------------|
| **A** | Dato del formulario |
| **B** | Derivado del cálculo / catálogo |
| **C** | Copy editorial por destino (`src/data/pdf-copy/`) |
| **D** | Hardcodeado / placeholder — eliminar o reemplazar |

Overrides opcionales (`includes`, `excludes`, `hotelHighlights`, `tags`, `experiencePricesUsd`, etc.) existen solo para fixtures/tests. `POST /api/generate-pdf` pasa únicamente `{ cotNumber, form, result, generatedAt }`.

## Página 1 — Propuesta

| Bloque | Clase | Fuente |
|--------|-------|--------|
| Saludo / nombre cliente | A | `form.clienteNombre` |
| Destino (título) | A | `form.destinos[0].destino` |
| Ubicación (subtítulo) | C | `copy.locationLabel` (fallback: nombre destino) |
| Tags | C (+ A) | `copy.defaultTags`; “Familia N pax” usa total pax del form |
| Precio por persona / total | B | `result.precioAdultoCliente`, `result.precioFinalCliente` |
| Método de pago + fee | A + B | `form.metodoPago` + `feeMultiplierLabel` |
| Nº cotización / fechas validez | A + B | `cotNumber`, `generatedAt`, `validUntil` (o +7 días) |
| Strip: salida / regreso | A | `form.fechaIda`, `form.fechaVuelta` |
| Strip: pasajeros / edades | A | `paxAdultos`, `paxMenores`, `edadesMenores` |
| Strip: alojamiento (noches + hotel) | A + B | fechas → noches; `hotelNombre` / categoría |
| Hotel nombre / meta | A | hotel + fechas formateadas |
| Hotel highlights | C + A | `copy.hotelHighlights` + ubicación / `hotelAjusteRazon` del form |
| ¿Qué incluye? | A + B | vuelos/hotel del form + nombres de excursión del catálogo |
| ¿Qué no incluye? | C | `copy.excludes` (genérico del destino; sin datos de un caso) |
| Itinerario | A | `form.itinerario` |
| Forma de pago (footer) | A | `paymentFooterLine(metodoPago)` |
| Disclaimer validez | B | `validUntil` |

## Página 2 — Guía del destino

| Bloque | Clase | Fuente |
|--------|-------|--------|
| Título guía + subtítulo | A + C | destino + `copy.guideSubtitle` |
| Experiencias incluidas (nombre) | B | catálogo `nombreLimpio` / alias de producto |
| Experiencias (detalle) | B | `proveedor` del catálogo (texto neutro) |
| Experiencias (precio USD) | B | neto catálogo + TC; override solo en tests |
| Upsells | C | `copy.upsells` (vacío si no hay copy del destino) |
| Tips / gastro / clima / packing | C | `copy.*` (fallback genérico; **no** inventar Iguazú) |

## Página 3 — Mapa + contacto

| Bloque | Clase | Fuente |
|--------|-------|--------|
| Resumen / mapa / pin | C | `copy.map` (coords 0,0 → fallback sin mapa inventado) |
| CTA Calendly / contacto | fijo producto | `CONTACT` en `format.ts` (marca Madero, no del caso) |

## Qué era (D) y se corrigió

| Ítem | Antes | Después |
|------|-------|---------|
| `iguazu.excludes` | Rutas Lima↔BUE, LATAM 2445, JetSMART, Mar 28 / Vie 31 | Exclusiones genéricas de Iguazú |
| `iguazu.hotelHighlights` | “descuento aplicado sobre tarifa rack” del caso | Highlights genéricos de selva |
| Detalle experiencias en template | “día completo PN Iguazú” / copy caso | Solo proveedor / neutro |
| Nombres excursión | Mappings mezclados con caso | `nombreLimpio` + alias de **producto** de catálogo |

## Regla de oro

Si el form no tiene un dato (cliente, hotel, fechas, aerolínea, ruta), el PDF **no** debe rellenarlo con el ejemplo Krystel / COT-0010. Copy (C) es editorial del **destino**, nunca del lead.
