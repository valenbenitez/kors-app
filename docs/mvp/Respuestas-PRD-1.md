# 💬 Respuestas Founder → CTO — Gaps y Decisiones (2026-07-16)

# ⚡ ACTUALIZACIÓN 2026-07-16 (2) — Clarificaciones del founder + BUG detectado

Kristhian aclaró 3 gaps abiertos. Ver detalle en §1 (Gap 4 nuevo) y §2 (Gaps 3, 4 marcados como resueltos).

**Resumen de cambios:**

| Item | Estado nuevo |
| --- | --- |
| Gap 3 (multi-destino hoteles) | ✅ RESUELTO — Opción A confirmada: se repite el proceso completo por cada destino |
| Gap 4 (NETO por PAX) | ✅ RESUELTO por estructura DB — NETO es per-adulto, `Precio menor` per-menor, `Política menores` define comportamiento |
| **🐛 BUG SKILL v2.8 detectado** | 🔴 La fórmula actual de excursiones NO usa `Precio menor` ni `Política menores`. Distribuye uniformemente por total_pax. Cálculos con menores están mal en todas las cotizaciones históricas con menores + `Política menores ≠ "Mismo adulto"`. |

**Acciones inmediatas:**

- Corregir Paso 1 + Paso 3 de la fórmula en [SKILL.md](http://SKILL.md) antes de que el CTO implemente
- Auditar cotizaciones históricas con menores para ver el impacto real
- Ver §1 → "Corrección Fórmula (Gap 4 resuelto)" abajo para la fórmula corregida

---

# ✅ Gap 4 RESUELTO — Corrección Fórmula Excursiones (nuevo)

Con la aclaración del founder + estructura de DB Excursiones, la lógica correcta es:

**Campos DB Excursiones relevantes:**

- `NETO` (number) — precio **por adulto**
- `Precio menor` (number) — precio **por menor** (usado solo si `Política menores = "Precio especial"`)
- `Política menores` (select) — comportamiento con menores:
    - `Mismo adulto` → aplicar `NETO` también al menor
    - `Precio especial` → usar `Precio menor` para el menor
    - `No aplica` → menor no paga (excursión gratis para menores)
    - `Consultar` → **STOP**, alertar vendedor "Excursión [X] con menores requiere consultar precio con proveedor"

## Paso 1 corregido — Conversión ARS→USD con handling de menores

```tsx
type ExcursionSel = {
  neto: number;               // NETO del DB
  moneda: "ARS" | "USD";
  precioMenor: number | null; // Precio menor del DB
  politicaMenores: "Mismo adulto" | "Precio especial" | "No aplica" | "Consultar";
};

function calcularNetoPorPaxUSD(exc: ExcursionSel, tc: Decimal): {
  netoAdultoUsd: Decimal;
  netoMenorUsd: Decimal;
} {
  // Adulto
  const netoAdultoUsd = exc.moneda === "ARS"
    ? new Decimal(exc.neto).div(tc)
    : new Decimal(exc.neto);

  // Menor según política
  let netoMenorUsd: Decimal;
  switch (exc.politicaMenores) {
    case "Mismo adulto":
      netoMenorUsd = netoAdultoUsd;
      break;
    case "Precio especial":
      if (exc.precioMenor === null) throw new Error(`Excursión con "Precio especial" pero sin Precio menor cargado`);
      netoMenorUsd = exc.moneda === "ARS"
        ? new Decimal(exc.precioMenor).div(tc)
        : new Decimal(exc.precioMenor);
      break;
    case "No aplica":
      netoMenorUsd = new Decimal(0);
      break;
    case "Consultar":
      throw new Error(`STOP: Excursión "${exc.nombre}" con política "Consultar" y hay menores. Consultar precio con proveedor.`);
  }
  return { netoAdultoUsd, netoMenorUsd };
}
```

## Paso 3 corregido — Subtotal USD con separación adulto/menor

**Fórmula NUEVA (reemplaza la actual del SKILL v2.8):**

```
Para cada excursión seleccionada:
  { netoAdultoUsd, netoMenorUsd } = calcularNetoPorPaxUSD(exc, TC)

exp_total_adultos_usd = Σ (netoAdultoUsd × pax_adultos por cada excursión)
exp_total_menores_usd = Σ (netoMenorUsd × pax_menores por cada excursión)
                        (si pax_menores = 0: exp_total_menores_usd = 0)

exp_adj_adultos = exp_total_adultos_usd    (sin gross-up de componente)
exp_adj_menores = exp_total_menores_usd    (sin gross-up de componente)

base_adulto (por PAX) = vuelo_ida_adulto_adj + vuelo_vuelta_adulto_adj + hotel_adulto_adj
base_menor  (por PAX) = vuelo_ida_menor_adj  + vuelo_vuelta_menor_adj  + hotel_menor_adj

subtotal_adultos = (base_adulto × pax_adultos) + exp_adj_adultos
subtotal_menores = (base_menor  × pax_menores) + exp_adj_menores
subtotal_usd     = subtotal_adultos + subtotal_menores
```

**Diferencia con el SKILL actual:**

| Aspecto | SKILL v2.8 actual (buggy) | Fórmula corregida |
| --- | --- | --- |
| Sumatoria excursiones | `total_experiencias_usd = Σ NETO` (asume grupo único) | `Σ (NETO × pax_adultos + Precio_menor × pax_menores)` |
| Distribución por PAX | `exp_por_pax = exp_adj ÷ total_pax` (uniforme) | Separado en `exp_adj_adultos`  • `exp_adj_menores` |
| Uso de `Política menores` | ❌ Ignorado | ✅ Determina si aplica NETO / Precio menor / 0 |
| Uso de `Precio menor` | ❌ Ignorado | ✅ Usado cuando política = "Precio especial" |

**Validación con COT-0007 (Kelly, 1 pax adulto, Iguazú):**

Con **1 pax** el bug no se manifiesta porque `pax_menores = 0` → `exp_total_menores_usd = 0`. El resultado con la fórmula corregida es idéntico: **USD 1289**.

**Casos donde el bug SÍ se manifiesta:**

- Cotizaciones con ≥2 pax donde al menos una excursión tiene `Política menores = "Precio especial"` → el skill actual cobra igual al menor que al adulto (over-charge)
- Cotizaciones con ≥1 menor donde alguna excursión tiene `Política menores = "No aplica"` → el skill actual prorratea uniformemente, subiendo el precio para adultos (over-charge)

**Impacto financiero:** en cotizaciones con menores, el cliente pagó DE MÁS. No es catastrófico (no perdió Madero dinero), pero el precio no fue justo para el cliente.

## Casos de prueba obligatorios (nuevos)

El CTO debe implementar estos 4 tests unitarios además del COT-0007:

**Test A — Excursión con `Mismo adulto` + 2 adultos + 1 menor:**

- NETO = USD 50, Precio menor = null, Política = "Mismo adulto"
- Esperado: exp_total = 50 × 2 (adultos) + 50 × 1 (menor mismo precio) = 150 USD

**Test B — Excursión con `Precio especial` + 2 adultos + 2 menores:**

- NETO = USD 100, Precio menor = USD 40, Política = "Precio especial"
- Esperado: exp_total = 100 × 2 + 40 × 2 = 280 USD

**Test C — Excursión con `No aplica` + 1 adulto + 2 menores:**

- NETO = USD 80, Precio menor = null, Política = "No aplica"
- Esperado: exp_total = 80 × 1 + 0 × 2 = 80 USD (menores no pagan)

**Test D — Excursión con `Consultar` + 1 adulto + 1 menor:**

- Esperado: STOP con error `Excursión "X" con política "Consultar" y hay menores. Consultar precio con proveedor.`

## Acción founder — corregir el SKILL antes de handoff

- [ ]  Actualizar `~/.claude/skills/cotizar-madero/SKILL.md` Fase 3 con la fórmula corregida arriba
- [ ]  Marcar v2.9 en el changelog: "Fix bug excursiones con menores — usa `Política menores` + `Precio menor`"
- [ ]  Auditar cotizaciones históricas con menores (query DB Cotizaciones donde `PAX Niños > 0`) — reportar diferencia entre precio cobrado y precio correcto
- [ ]  Compartir SKILL v2.9 al CTO (evita que implemente la versión buggy)

---

# ✅ Gap 3 RESUELTO — Multi-destino confirmado

**Regla operativa (aclarada por founder):**

Multi-destino = por cada destino se ejecuta el mismo proceso de cotización con sus propios datos. NO es un "combo" agregado, son cotizaciones parciales que se unen en un solo PDF.

**Estructura del wizard multi-destino:**

Cuando el vendedor selecciona ≥2 destinos en Paso 1, el wizard **repite Pasos 2, 3 y 4 una vez por destino**:

```
Paso 1  — Cliente + Viaje (destinos = [Iguazú, Bariloche])
Paso 2a — Vuelos hacia/desde Iguazú (4 precios ARS)
Paso 3a — Hotel Iguazú (adulto + menor + metadata)
Paso 4a — Excursiones Iguazú (multi-select filtrado por destino=Iguazú)
Paso 2b — Vuelos hacia/desde Bariloche (4 precios ARS)
Paso 3b — Hotel Bariloche (adulto + menor + metadata)
Paso 4b — Excursiones Bariloche (multi-select filtrado por destino=Bariloche)
Paso 5  — Confirmación con resumen (suma de los 2 subpaquetes)
```

**Fórmula aplicada:**

Se corre la fórmula 9 pasos **sobre los totales agregados** (no por destino separado):

```
subtotal_usd = sum(subtotal_destino_1, subtotal_destino_2, ..., subtotal_destino_N)
```

Después Paso 4 (margen), Paso 5 (fee), Paso 8 (vendedor), Paso 9 (CEILING) se aplican **al total, no por destino**.

**Storage en DB Cotizaciones:**

Extender el schema de `cotizaciones.destinos[]` a un array de objetos:

```tsx
destinos: [
  {
    destino: "Iguazú",
    vueloIdaAdultoArs: 147500,
    vueloIdaMenorArs: 0,
    vueloVueltaAdultoArs: 147881,
    vueloVueltaMenorArs: 0,
    hotelAdultoArs: 399207,
    hotelMenorArs: 0,
    hotelNombre: "Amérian Portal del Iguazú",
    hotelCategoria: "5★",
    hotelAjusteArs: -47905,
    excursiones: [...],
    subtotalUsdDestino: 779.01,   // audit por destino
  },
  {
    destino: "Bariloche",
    // ... mismos campos
  }
],
```

**Template PDF multi:**

- `hotels_section_html` = grid de N cards (una por hotel del array `destinos[]`)
- `maps_section_html` = grid de N mini-mapas
- `experiencias_incluidas_html` = grupos por destino con emoji + rows
- `excursions_upsell_html` = 3 cards de upsell tomadas del PRIMER destino (o rotar entre destinos)
- `hotels_summary` = string derivado: "N hoteles 4★+"
- `destination_short` = si es 2 destinos: "Iguazú + Bariloche". Si es 3+: "Iguazú + Bariloche + 1 más"

## Acción CTO — Multi-destino

- [ ]  Wizard: Paso 2/3/4 dinámicos según cantidad de destinos seleccionados en Paso 1
- [ ]  Fórmula: agregar subtotales por destino antes de Paso 4 (margen)
- [ ]  Schema Convex: `cotizaciones.destinos[]` como array de objetos
- [ ]  Template multi: renderear grids con N cards según `destinos.length`
- [ ]  Testing: agregar caso de aceptación con 2 destinos (buscar 1 hist en DB Cotizaciones)

---

# ✅ Marcar en §2 como resueltos

Los gaps abiertos originales de §2 (que enviaba a Madero) quedan reducidos a **UNO SOLO**:

- ~~Gap 3 (multi-destino hoteles)~~ ✅ RESUELTO — ver arriba
- ~~Gap 4 (NETO por PAX)~~ ✅ RESUELTO por estructura DB — ver arriba
- **Gap 5 (ajuste operador con menores)** — SIGUE ABIERTO, único que necesita Madero

Sobre **Gap 5**: la pregunta a Madero es "cuando hay ajuste operador del hotel (ej. -47.905 ARS) y hay menores en la cotización, ¿el ajuste se resta solo del precio del adulto o se prorratea entre adulto y menor?"

Recomendación mientras Madero responde: **aplicar solo al adulto** (Opción A). Es más conservador y evita over-discount a menores. Documentar como default y ajustar si Madero responde distinto.

---

# 0. Contexto

Este documento responde al **KORS PRD** producido por el CTO el 2026-07-16, que a su vez fue construido a partir del [spec principal](https://app.notion.com/p/Cotizador-Web-App-Spec-CTO-Inputs-Data-Sources-F-rmula-PDF-39fd7e4f683b8021a1b5eda1643c753b?pvs=21) (Cotizador Web App — Spec CTO). 

**Estructura:**

- §1 Decisiones cerradas por founder (para los 6 gaps del CTO que puedo resolver con criterio + reglas explícitas)
- §2 Preguntas que requieren input directo de Madero antes de codear (3 gaps)
- §3 Gaps que el CTO omitió y son críticos (8 items)
- §4 Pedidos de acceso y archivos para el CTO (bloqueantes de arranque)
- §5 Priorización sugerida
- §6 Próximo paso operativo

**Convención:** cada bloque termina con `→ Acción CTO:` con lo que debe hacer concretamente.

---

# 1. Decisiones cerradas por founder

## Gap 1 — Itinerario día por día

**Decisión: Opción B (auto-generado desde excursiones) + textarea editable como override manual.**

**Regla determinística de generación automática:**

```
Día 1 (fecha ida): Check-in destino [X]. [Actividad libre / primera excursión si es hoy]
Día 2..N-1: [Excursión del día en orden de selección del vendedor]
Último día (fecha vuelta): Check-out + traslado al aeropuerto
```

**Detalle de implementación:**

- Ordenar excursiones por fecha si el vendedor las asigna a un día específico; si no, distribuir 1 por día en orden de selección
- Si hay más excursiones que días → mostrar 2 en el mismo día con separador
- Si hay más días que excursiones → poner "Tiempo libre / actividades opcionales" en los días vacíos
- **Textarea editable** con el itinerario auto-generado precargado. Vendedor puede ajustar antes de generar PDF.
- Guardar el itinerario final (editado) en `cotizaciones.itinerario` (text) para audit.

**Placeholder afectado:** `itinerary_html` en ambos templates.

**Formato HTML:**

```html
<div class="day"><div class="day-num">Día 1</div><div class="day-content">Llegada a Iguazú · Check-in Amérian Portal · Tarde libre</div></div>
<div class="day"><div class="day-num">Día 2</div><div class="day-content">Cataratas Argentinas + Gran Aventura (full day)</div></div>
...
```

→ **Acción CTO:** implementar generador determinístico + textarea override en Paso 5 del wizard (confirmación).

---

## Gap 2 — Detalle de vuelos (revisitado — el CTO cerró prematuro)

**Advertencia:** el CTO decidió "solo precios, sin detalles de vuelo", pero eso deja las cards visuales del PDF vacías o rotas. Requiere corrección.

**Decisión revisada: Opción C híbrida — cards genéricas sin código IATA en MVP.**

**Detalle:**

- El wizard pide solo los 4 precios ARS (decisión CTO se mantiene)
- El PDF renderea cards con datos derivados de lo que ya tenemos:
    - **Título card**: "Vuelo ida" / "Vuelo vuelta"
    - **Fecha**: `fecha_ida` / `fecha_vuelta` del wizard
    - **Destino**: destino confirmado del cliente (usar código IATA hardcoded por destino — ver tabla abajo)
    - **Ruta**: origen `AEP` (Aeroparque) por default → IATA destino
    - **Aerolínea**: campo opcional `aerolinea` del wizard (si vacío → "Aerolínea a confirmar")
    - **Horarios**: NO mostrar (evitar información falsa)

**Tabla IATA por destino (hardcoded — MVP):**

| Destino | IATA |
| --- | --- |
| Iguazú | IGR |
| Bariloche | BRC |
| Calafate | FTE |
| Ushuaia | USH |
| Salta-Jujuy | SLA |
| Mendoza | MDZ |
| Buenos Aires | AEP |
| Uruguay | MVD |

**Origen siempre = `AEP` (Aeroparque Jorge Newbery)** para viajes domésticos. Si el cliente viene de otro país → dejar `AEP` como default (el vuelo internacional lo trae el cliente, cotizamos solo el doméstico).

**v2 (post-MVP):** agregar campos opcionales al wizard para: nro vuelo, aerolínea completa, horario ida/vuelta, aeronave. Solo si el vendedor los completa se muestran en las cards; si no, fallback a genérico.

→ **Acción CTO:** implementar tabla IATA hardcoded + cards con datos derivados + campo `aerolinea` opcional en wizard.

---

## Gap 6 — Sección clima (pág 1 PDF single)

**Decisión: tabla hardcoded `clima_por_destino_temporada` — 32 filas.**

**Estructura de la tabla:**

```tsx
interface ClimaEntry {
  destino: string;      // "Iguazú", "Bariloche", etc.
  temporada: string;    // "Verano", "Otoño", "Invierno", "Primavera"
  clima_title: string;  // ej. "Verano en Iguazú"
  clima_icon: string;   // emoji: ☀️ / 🌧️ / ❄️ / 🍂 / 🌸
  clima_season: string; // ej. "Diciembre — Febrero"
  clima_temp: string;   // ej. "25°C — 35°C"
  clima_desc: string;   // ej. "Cálido y húmedo, chubascos tropicales frecuentes."
}
```

**8 destinos × 4 temporadas = 32 filas** (agregar cuando se sumen destinos nuevos).

**Ejemplo de contenido a completar (founder redacta o pide a ChatGPT):**

| Destino | Temporada | Título | Icon | Season | Temp | Desc |
| --- | --- | --- | --- | --- | --- | --- |
| Iguazú | Verano | Verano en Iguazú | ☀️ | Dic — Feb | 25°C — 35°C | Cálido y húmedo, chubascos tropicales frecuentes. |
| Iguazú | Otoño | Otoño en Iguazú | 🍂 | Mar — May | 18°C — 28°C | Agradable, menos humedad, buena visibilidad de cataratas. |
| Bariloche | Invierno | Invierno en Bariloche | ❄️ | Jun — Ago | -3°C — 8°C | Temporada de ski, nieve abundante en Cerro Catedral. |
| ... |  |  |  |  |  |  |

**Lookup en runtime:** `configTC` no aplica acá. Usar tabla propia `climaPorDestino` en Convex.

**Multi-destino:** si el paquete tiene >1 destino, mostrar el clima del **primer destino de la lista** (o del destino más largo por noches — a decidir en implementación).

→ **Acción founder:** completar las 32 filas de contenido (2-3h con ChatGPT como asistente) y compartir CSV al CTO.

→ **Acción CTO:** crear tabla `climaPorDestino` en Convex + endpoint lookup por `(destino, temporada)`.

---

## Gap 7 — Ranking upsells sin LLM

**Decisión: agregar columna `tags` (multi-select) a DB Excursiones + taggear las 199 filas manualmente. Trabajo del founder.**

**Tags disponibles (multi-select — una excursión puede tener varios):**

- `kid-friendly` — apta para menores, sin adrenalina
- `romantico` — pareja, atmósfera romántica (atardecer, cena, vuelo helicóptero)
- `aventura` — adrenalina, trekking exigente, rappel, kayak
- `panoramica` — vistas emblemáticas (must-see fotográfico)
- `gastronomico` — degustación, cervecería, ruta vinos
- `premium` — alto costo, exclusividad (helicóptero, tour privado)
- `natural` — fauna, flora, contacto naturaleza (aves, glaciares)
- `cultural` — museo, historia, patrimonio

**Algoritmo de ranking sin LLM:**

```tsx
function rankUpsells(candidates: Excursion[], perfil: string): Excursion[] {
  const preferredTags = PERFIL_TAG_MAP[perfil] || [];
  return candidates
    .map(e => ({
      e,
      score: e.tags.filter(t => preferredTags.includes(t)).length * 10 + e.neto_usd,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(x => x.e);
}

const PERFIL_TAG_MAP: Record<string, string[]> = {
  "Familia con niños": ["kid-friendly", "panoramica", "natural"],
  "Pareja": ["romantico", "gastronomico", "premium"],
  "Aventura": ["aventura", "natural"],
  "Lujo": ["premium", "gastronomico", "romantico"],
  "Primer viaje": ["panoramica", "cultural", "natural"],
  "Grupo adultos": ["gastronomico", "panoramica", "aventura"],
  "Otro": [],  // solo tie-breaker por NETO
};
```

**Fallback si `candidates.tags` está vacío (excursiones sin taggear):** ordenar solo por `NETO desc` (tie-breaker sugerido en el skill).

→ **Acción founder:** agregar columna `tags` a DB Excursiones + taggear las 199 filas (2-3h manuales).

→ **Acción CTO:** implementar `rankUpsells()` + `PERFIL_TAG_MAP` constante.

---

## Gap 8 — Moneda local (Paso 7 fórmula)

**Decisión: DESCARTAR para MVP.**

**Razón:** el vendedor puede mencionar verbalmente al cliente el precio equivalente en su moneda usando TC de referencia externo (Google, Wise). Meter esto en el wizard agrega complejidad para bajo valor.

**Impacto:**

- El wizard NO tiene campo `TC_USD_LOCAL`
- El PDF NO muestra precio en moneda local
- El backend NO ejecuta Paso 7 de la fórmula (queda como código muerto, comentar para v2)

**Reactivación v2:** si Madero pide precio en moneda local en el PDF, agregar:

- Campo opcional `moneda_local` (COP/CLP/BRL/PEN/USD-USA) en Paso 1 del wizard
- Campo opcional `TC_USD_LOCAL` autocompletado con lookup a `configTC` (que ya tiene los pares USD/COP, USD/CLP, USD/BRL, USD/PEN)
- Fila nueva en PDF: `USD 1.289 ≈ COP 5.156.000` en el hero

→ **Acción CTO:** implementar sin Paso 7 en MVP. Dejar tabla `configTC` con multi-moneda (ya viene así del Notion actual).

---

## Gap 10 — Filtrado de tips por sinónimos

**Decisión: match exacto solo. Aceptar bug conocido en MVP.**

**Regla:**

```tsx
function filterRedundantTips(tips: Tip[], excursionesEnPaquete: Excursion[]): Tip[] {
  const excNames = excursionesEnPaquete.map(e => e.nombre_limpio.toLowerCase());
  return tips.filter(tip => {
    const tipContent = (tip.title + " " + tip.description).toLowerCase();
    // Excluir si el título/desc del tip contiene EL NOMBRE LIMPIO EXACTO de una excursión del paquete
    return !excNames.some(name => tipContent.includes(name));
  });
}
```

**Bug conocido aceptado:** si un tip habla de "PN Iguazú" y la excursión se llama "Cataratas Argentinas", el tip aparecerá como no-redundante y podría mostrarse aunque sea redundante.

**Mitigación operativa:** curar la DB Tips & Gastro con títulos que **matcheen exacto con los nombres limpios de excursiones**. Ej: si hay excursión "Cataratas Argentinas", el tip debería llamarse "Consejos para Cataratas Argentinas" en vez de "Consejos para PN Iguazú".

**v2 (post-MVP):** construir diccionario manual de sinónimos `synonyms.json` (~50 entradas: "cataratas argentinas" → ["lado argentino", "pn iguazú", "parque nacional iguazú"]). Trabajo bajo pero curación cuidadosa.

→ **Acción CTO:** implementar match exacto simple. NO invertir esfuerzo en NLP fuzzy.

---

# 2. Preguntas que requieren input DIRECTO de Madero

Estas NO puedo cerrarlas yo. Necesitan que Kristhian pregunte a Sebastián/Mariano/Madero.

## Gap 4 — NETO por PAX (BUG posible en la fórmula actual)

**Pregunta a Madero:** "En DB Excursiones, ¿el campo `NETO` es el precio POR ADULTO o el precio TOTAL de la excursión (para todo el grupo)?"

**Caso concreto para validar:**

Excursión "Circuito Chico" en Bariloche con `NETO = USD 50` y `Precio menor = USD 25`.

Cotización con 2 adultos + 1 menor:

- **Si NETO es por adulto:** total exc = 50 × 2 + 25 × 1 = 125 USD → `exp_por_pax = 125/3 = 41.67`
- **Si NETO es total grupo:** ??? no aplica `Precio menor` → total = 50 USD → `exp_por_pax = 50/3 = 16.67`

**Impacto:** los precios difieren un ~2.5× en cotizaciones multi-pax. Si la interpretación actual del skill está mal, todas las cotizaciones históricas COT-0007+ con ≥2 pax están mal calculadas.

**Cómo validar:** buscar en DB Cotizaciones un caso histórico con ≥2 pax + excursiones y revisar el `Costo Neto USD` registrado. Comparar con lo que devuelve la fórmula del skill.

→ **Acción Kristhian:** preguntar a Madero + revisar 1 cotización histórica con multi-pax. Actualizar el SKILL v2.8 con la respuesta correcta antes de que el CTO implemente.

---

## Gap 5 — Ajuste operador con menores

**Pregunta a Madero:** "Cuando cotizás con hotel para adultos + menores y el operador aplica un ajuste (ej. -47.905 ARS), ¿el ajuste solo baja del precio del adulto, o se prorratea entre adulto y menor?"

**Escenario:**

Hotel adulto ARS 400.000, hotel menor ARS 200.000. Ajuste operador -50.000 ARS.

- **Opción A (solo al adulto):** adulto = 350.000, menor = 200.000
- **Opción B (prorrateado):** adulto = 400.000 × 0.9167 = 366.667, menor = 200.000 × 0.9167 = 183.333

→ **Acción Kristhian:** preguntar a Madero. Documentar la respuesta en [SKILL.md](http://SKILL.md) y en el spec del CTO.

---

## Gap 3 — Multi-destino y hoteles

**Pregunta a Madero:** "Cuando cotizás un viaje multi-destino (ej. Iguazú + Bariloche), ¿cargás 1 hotel por destino separado, o un combo/paquete?"

**Opciones para el wizard:**

- **Opción A (recomendada):** vendedor selecciona destinos en Paso 1, y Paso 3 se repite N veces (una por destino). Cada uno con sus propios precios adulto/menor + metadata.
- **Opción B:** vendedor carga un total combinado del hotel (más simple, menos detalle).

**Impacto en template multi:**

- Opción A → template renderea grid `hotels_section_html` con N cards (una por hotel)
- Opción B → template renderea 1 card genérica "N hoteles combinados"

**Recomendación mía:** Opción A. Mantiene granularidad + auditoría + coincide con cómo el operador cotiza (siempre un hotel por destino).

→ **Acción Kristhian:** confirmar Opción A con Madero (99% probable). Si es A, wizard cambia estructura (paso 3 dinámico).

---

# 3. Gaps que el CTO omitió (agrego yo — críticos)

## O.1 — Cards de vuelos con datos genéricos (ya cubierto en Gap 2 revisitado)

Ver §1 Gap 2 arriba. Sin esta corrección el PDF sale roto visualmente.

---

## O.2 — 9 placeholders sin fuente definida en mi spec

El CTO detectó solo `clima_*`. Faltan estas fuentes:

| Placeholder | Fuente propuesta |
| --- | --- |
| `hero_tags_html` | Generado automáticamente: `[🎖 Premium si aplica] + [perfil cliente como tag] + [Multi-destino si N>1]`. Colores desde tabla brand tokens. |
| `packing_html` | Query DB Tips & Gastro filtered `Tipo=Qué llevar`. Renderear como `<ul><li>[desc]</li>...</ul>` |
| `packing_section_title` | Fijo: `"Qué llevar para tu viaje"` |
| `hotel_stars_label` | Formato: si `categoria = "5★"` → renderear `★★★★★` (5 estrellas Unicode). Si vacío → string vacío. |
| `p2_sub` | Fijo: `"Experiencias y consejos para tu viaje"` |
| `nights_label` | Formato: `"{N} noches"` donde N = `diff(fecha_vuelta, fecha_ida)`. Sin destino. |
| `payment_method_desc` | Mapa fijo: `tarjeta → "Pago con tarjeta (VISA/Mastercard)"`, `beetransfer → "Transferencia via BeeTransfer"`, `efectivo → "Pago en efectivo"` |
| `date_formatted` | Formato ISO larga español: `"14 de agosto de 2026"` (usa `Intl.DateTimeFormat` con locale `es-AR`) |
| `destination_loc` | Sale de DB Mapas Destinos campo `Summary` (mismo dato que `destino_summary`). Confirmar si son el mismo placeholder duplicado o distintos. |
| `valid_until_full` | Formato: `"14 de agosto de 2026"` (fecha ida + 7 días de vigencia). Constante `VALIDEZ_COTIZACION_DIAS = 7` en config. |
| `valid_until_short` | Formato: `"14/08/2026"` |

→ **Acción CTO:** implementar cada uno según regla propuesta. Si algo no queda claro, pedirle a Kristhian ejemplos reales de PDFs previos.

---

## O.3 — Cleaning regex títulos excursión (crítico)

Esto está en §6.3 del spec principal pero el CTO no lo priorizó. **Sin esto, el PDF muestra códigos internos al cliente.**

**Regex exacto que tiene que implementar (JavaScript/TypeScript):**

```tsx
function cleanExcursionTitle(raw: string): string {
  let s = raw;
  // 1. Quitar prefijos
  s = s.replace(/^(EXC |PQT \d+ · |PQT \d+ |EXC\d+ )/, "");
  // 2. Quitar sufijos internos
  s = s.replace(/\s*[-—·]\s*(TITO|H1|NITES|CARACOL|VITIVINICOLA|BUS VITIVINICOLA|\(.*\))$/, "");
  // 3. Quitar "Excursión" inicial redundante
  s = s.replace(/^Excursi[óo]n\s+/i, "");
  return s.trim();
}

// Casos de prueba obligatorios:
// "PQT 05 · Cataratas Arg + Bras + Transfers (REGULAR) — CARACOL" → "Cataratas Arg + Bras + Transfers"
// "EXCURSION GRAN AVENTURA (TITO) — PARA FULL DAY" → "Gran Aventura — Full Day"
// "Full Day Iguazú Privado TITO" → "Full Day Iguazú Privado"
// "EXC Circuito Chico" → "Circuito Chico"
```

**En DB `cotizaciones.excursiones[]` guardar AMBOS:** `nombreOriginal` (audit interno) + `nombreLimpio` (mostrar en PDF).

→ **Acción CTO:** implementar como utility + tests. NO opcional.

---

## O.4 — Race condition en asignación de `COT-XXXX`

Si Sebastián y Mariano cotizan al mismo tiempo, pueden asignar el mismo número. En Convex se resuelve así:

```tsx
// convex/cotizaciones.ts
export const createCotizacion = mutation({
  handler: async (ctx, args) => {
    // Convex mutations son transaccionales por default — no hay race
    const last = await ctx.db
      .query("cotizaciones")
      .order("desc")
      .first();
    const nextNum = last ? parseInt(last.nroCotizacion.split("-")[1]) + 1 : 1;
    const nroCotizacion = `COT-${String(nextNum).padStart(4, "0")}`;
    // ... crear con nroCotizacion
  },
});
```

**Convex mutations son ACID por default** — dos concurrentes se serializan automáticamente. Documentarlo pero implementar la lógica arriba.

**Si el stack final NO es Convex** (ej. Firestore): implementar con `runTransaction()` + contador atómico en documento separado.

→ **Acción CTO:** documentar la garantía de atomicidad del stack elegido + implementar contador atómico si no es automático.

---

## O.5 — Testing paralelo skill + app (2 semanas antes de go-live)

**No opcional.** Antes de retirar el skill actual, correr 2 semanas donde el vendedor cotiza el mismo caso con ambos sistemas y comparamos outputs.

**Criterios de aceptación para go-live:**

- ≥20 cotizaciones reales corridas en paralelo
- Diferencia en `Precio Final USD` ≤ USD 1 (por el CEILING)
- Diferencia en `Costo Neto USD` = 0 (exacto HALF_UP)
- PDF visualmente indistinguible (revisión manual de 5 casos aleatorios)

**Si algún caso falla:** corregir bug + reiniciar contador de 20 casos.

→ **Acción CTO:** agregar Fase 8.5 al plan de trabajo. Fase 9 (retiro del skill) queda bloqueada hasta pasar.

---

## O.6 — Panel admin + usuarios + dashboard

El CTO se enfocó 100% en el formulario del vendedor. Falta:

**Panel admin (para Kristhian):**

- Login separado del vendedor (rol `admin`)
- CRUD sobre: `configTC` (TC diario), `formulaParams`, `excursiones` (activar/desactivar, editar NETO), `mapasDestinos`, `tipsGastro`, `climaPorDestino`, `usuarios` (agregar/quitar vendedores)
- Auditoría de cambios (quién editó qué, cuándo)

**Dashboard read-only (para vendedor y admin):**

- Vendedor: sus últimas 20 cotizaciones + total mes
- Admin: todas + ranking vendedores + top destinos + conversión + margen agencia + margen vendedor (para liquidar comisiones)

**Trabajo estimado:** 5-7 días adicionales de UI. Sin esto la app no es operable.

→ **Acción CTO:** incluir panel admin + dashboard mínimo en el scope MVP. Estimar effort + confirmar.

---

## O.7 — Decisión de stack (Convex vs Firestore)

El CTO no menciona qué stack usará. Bloqueante.

**Recomendación founder:** **Convex + Cloud Run (PDF) + Vercel (frontend) + Firebase Storage (PDFs)**.

**Razones (ver spec principal §1):**

- Convex: menos consolas (2 vs 5), TypeScript end-to-end, deploys automáticos, mutations transaccionales por default
- Cloud Run: única forma limpia de correr Playwright/Chromium fuera de VPS
- Vercel: standard, deploys automáticos por push a `main`, custom domain fácil
- Firebase Storage: signed URLs, free tier

→ **Acción CTO:** confirmar stack (o proponer alternativa con justificación técnica).

---

## O.8 — Priorización + effort estimate

El CTO listó gaps sin ordenarlos por criticidad ni estimar effort. Sin esto no podés planear.

**Ver §5 abajo — priorización que propongo.**

→ **Acción CTO:** validar priorización + agregar effort estimate (días) por bloque.

---

# 4. Pedidos concretos de acceso y archivos para el CTO

**Bloqueantes de arranque — sin esto no puede validar nada.**

## 4.1 Acceso a Notion DBs

5 opciones:

**Opción A (recomendada): compartir con integración del CTO**

- Kristhian obtiene el email/integration ID del CTO y comparte las 5 páginas/DBs con permisos de lectura
- Ventaja: acceso live, si Madero actualiza el catálogo el CTO lo ve en tiempo real

**Opción B: export CSV de cada DB + snapshot**

- Kristhian exporta cada DB Notion a CSV y las manda al CTO
- Ventaja: cero setup Notion para el CTO
- Desventaja: snapshot estático, no refleja cambios

**Páginas/DBs a compartir:**

| Recurso | Notion ID |
| --- | --- |
| Config TC + Parámetros | `382d7e4f-683b-811d-9a53-ca28bcd85365` |
| DB Excursiones (199 filas) | `384d7e4f-683b-81f7-8ba9-fca0dc2d97e1` |
| DB Tips & Gastro | `dae4c54d-2869-46d2-866d-537042855155` |
| DB Mapas Destinos (24 filas) | `2b24a75d-9fe7-4f34-9103-7d503df42849` |
| DB Cotizaciones (histórico COT-0001+) | `fc5943af-5d5f-4b47-ba51-28ab56cef2f8` |

→ **Acción Kristhian:** decidir Opción A o B + ejecutar hoy mismo.

---

## 4.2 Archivos locales

Zipear el folder `~/.claude/skills/cotizar-madero/` y mandar por Drive al CTO. Incluye:

- `SKILL.md` (958 líneas — fuente de lógica v2.8)
- `templates/template_single_v26.html` (24 KB)
- `templates/template_multi_v1.html` (17 KB)
- `assets/madero_logo_white.b64` (~63 KB)
- `scripts/calculo_7_pasos.py` (helpers Decimal)
- `scripts/html_to_pdf_playwright.py` (renderer referencia)
- `scripts/notion_writes.py`, `pdf_render.py`, `drive_upload.py`, `mapas_lookup.py`, `tc_params.py` (skeletons de referencia)

**Alternativa:** dar acceso al repo backup `github.com/kristhiancardenas2020-ui/agency-madero` (folder `skills/cotizar-madero/`).

→ **Acción Kristhian:** compartir hoy. Backup GitHub es lo más simple.

---

## 4.3 Caso de aceptación COT-0007

El CTO necesita replicar exactamente esta cotización para validar la fórmula.

**Package a entregar:**

1. **Inputs originales** (mensaje WhatsApp del cliente + prompt del vendedor)
2. **Valores intermedios** de cada paso de la fórmula (TC usado, subtotal_usd, precio_paquete, precio_post_fee, precio_final, margen_vendedor)
3. **PDF generado** (para comparación visual)
4. **Registro en DB Cotizaciones** (todos los campos con sus valores)
5. **Output esperado**: `precio_final_cliente = USD 1289`

**Test unitario obligatorio:** "Given inputs X, formula returns Y" — replicable en cualquier lenguaje.

→ **Acción Kristhian:** exportar COT-0007 completo desde Notion + Drive + mandarlo al CTO.

---

# 5. Priorización sugerida

## Bloqueantes MVP (semana 1)

1. **Compartir acceso + archivos** (§4.1, §4.2, §4.3) — sin esto no arranca
2. **Gap 4 (NETO por PAX)** — puede invalidar toda la fórmula. Kristhian pregunta a Madero HOY.
3. **Gap 3 (multi-destino hoteles)** — cambia schema del wizard
4. **Gap 2 revisitado (vuelos)** — cambia diseño del wizard
5. **O.3 (cleaning regex títulos)** — sin esto PDF muestra códigos al cliente
6. **O.7 (stack decision)** — sin esto el CTO no empieza

## Alto (semana 1-2)

1. **Gap 1 (itinerario)** — Opción B decidida, implementar
2. **Gap 5 (ajuste operador)** — Kristhian pregunta a Madero
3. **Gap 6 (clima)** — Kristhian completa tabla 32 filas
4. **Gap 7 (tags upsell)** — Kristhian taggea 199 filas
5. **O.2 (placeholders sin fuente)** — CTO implementa según reglas

## Medio (semana 2-3)

1. **O.6 (panel admin + dashboard)** — CTO estima effort + implementa
2. **O.4 (race condition COT-XXXX)** — CTO documenta + implementa
3. **O.5 (testing paralelo)** — Fase 8.5, no negociable

## Bajo / diferir a v2

1. **Gap 8 (moneda local)** — descartar MVP
2. **Gap 10 (sinónimos)** — match exacto solo
3. **Gap 9 (Calendly)** — placeholder OK

---

# 6. Próximo paso operativo

**Kristhian (hoy):**

- [ ]  Compartir acceso a 5 Notion DBs con el CTO (Opción A o B)
- [ ]  Mandar zip de `~/.claude/skills/cotizar-madero/` al CTO
- [ ]  Mandar package COT-0007 al CTO
- [ ]  Preguntar a Madero: Gap 4 (NETO por PAX), Gap 5 (ajuste operador con menores), Gap 3 (multi-destino hoteles)
- [ ]  Completar tabla `clima_por_destino` (32 filas) usando ChatGPT como asistente — compartir CSV al CTO
- [ ]  Taggear 199 filas de DB Excursiones con los 8 tags del §1 Gap 7

**CTO (esta semana, después de recibir todo):**

- [ ]  Confirmar stack (Convex + Cloud Run + Vercel + Firebase Storage — o proponer alternativa)
- [ ]  Validar priorización de §5 + agregar effort estimate por bloque
- [ ]  Implementar test unitario COT-0007 como primer entregable (feedback rápido de si la fórmula funciona)
- [ ]  Incluir panel admin + dashboard en scope MVP
- [ ]  Agregar Fase 8.5 (testing paralelo 2 semanas)

**Founder + CTO (semana 2):**

- [ ]  Sync 30 min para cerrar gaps que hayan aparecido durante implementación
- [ ]  Revisar primer prototipo de PDF generado (comparar contra COT-0007 real)

---

*Doc generado 2026-07-16 en respuesta al KORS PRD del CTO. Fuente principal: [Cotizador Web App — Spec CTO](https://app.notion.com/p/Cotizador-Web-App-Spec-CTO-Inputs-Data-Sources-F-rmula-PDF-39fd7e4f683b8021a1b5eda1643c753b?pvs=21) sección §5 (fórmula v2.8), §6 (reglas especiales), §7 (templates PDF).*