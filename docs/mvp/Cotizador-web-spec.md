# 📋 Cotizador Web App — Spec CTO (Inputs · Data Sources · Fórmula · PDF)

# 0. Contexto y objetivo

**Qué es:** app web para que los vendedores de Madero (Sebastián, Mariano) generen cotizaciones de viaje que resultan en un PDF idéntico al que hoy produce el skill `/cotizar-madero` v2.8.

**Qué reemplaza:** flujo actual donde el founder (Kristhian) corre el skill en Claude Code. El objetivo es que los vendedores lo hagan solos vía navegador, sin depender de Claude, sin LLM en runtime.

**Requisitos duros del PDF resultado:**

- Debe ser visualmente idéntico al PDF actual (mismo layout, mismos colores, mismos tokens de brand)
- Debe usar la misma fórmula v2.8 (9 pasos con `Decimal`, sin `float`)
- Debe leer el catálogo real de Madero (excursiones, mapas, tips)
- Debe guardar registro en una DB con los mismos campos que hoy usa DB Cotizaciones Notion

**Fuentes actuales del skill:**

- Skill code: `~/.claude/skills/cotizar-madero/SKILL.md` (v2.8, 958 líneas)
- Template PDF single: `~/.claude/skills/cotizar-madero/templates/template_single_v26.html` (24 KB)
- Template PDF multi: `~/.claude/skills/cotizar-madero/templates/template_multi_v1.html` (17 KB)
- Logo base64: `~/.claude/skills/cotizar-madero/assets/madero_logo_white.b64`
- Helper Decimal: `~/.claude/skills/cotizar-madero/scripts/calculo_7_pasos.py`
- Backup repo: `github.com/kristhiancardenas2020-ui/agency-madero` (folder `skills/cotizar-madero/`)

---

# 1. Stack propuesto

| Capa | Herramienta | Notas |
| --- | --- | --- |
| Frontend | Next.js en Vercel | Wizard 5 pasos + admin/dashboard |
| Backend | Convex | Backend + DB + Auth + Storage integrados |
| PDF gen | Cloud Run (container Docker con Playwright + Chromium) | Convex no puede correr Chromium — necesita servicio separado |
| Notion sync inicial | Script one-time (Node/Python) | Copia catálogo Notion → Convex tables |
| Auth | Firebase Auth vía Convex, o Convex Auth con Google Workspace | 2 vendedores + 1 admin al inicio |
| Storage PDF | Firebase Storage con signed URLs, o Convex file storage | Vendedor descarga y manda por su WhatsApp |
| Observabilidad | Sentry + PostHog | Desde día 1 |
| CI/CD | GitHub + Vercel auto-deploy + `npx convex deploy` | Push a `main` = deploy |
| Dominio | Subdominio Kore (a definir) | `cotizador.kore.beetransfer.net` o similar |
| Costo mensual estimado | ~USD 0-15 | Free tier cubre volumen Madero (~400 cotizaciones/mes) |

**Alternativa NO recomendada:** VPS actual de Kore. Funciona pero acopla el cotizador a la infra de Agency Core (single point of failure compartido). Preferir Cloud Run + Convex para aislamiento.

---

# 2. Flujo del vendedor (end-to-end)

1. Vendedor abre `cotizador.kore.beetransfer.net` en el navegador (móvil o desktop)
2. Login con Google Workspace de Madero (o password)
3. Wizard 5 pasos (ver §3 abajo)
4. Click **"Generar cotización"** → PDF listo en 5-10 segundos
5. Vendedor descarga PDF o copia link
6. Manda el PDF por su WhatsApp al cliente (fuera de la app, manual)
7. Opcional: vuelve más tarde a marcar la cotización como `enviada / convertida / rechazada`

---

# 3. INPUTS del wizard — todos los campos que se piden al vendedor

## Paso 1 — Cliente + Viaje (datos básicos)

| Campo | Tipo | Obligatorio | Ejemplo |
| --- | --- | --- | --- |
| Nombre completo cliente | text | Sí | `Kelly Patricia` |
| País de origen | select (Argentina, Colombia, Chile, Brasil, Perú, Uruguay, Paraguay, USA, España, Otro) | Sí | `Colombia` |
| WhatsApp cliente (con código país) | phone | Sí | `+57 320 555 1234` |
| Perfil del cliente | select (Pareja / Familia con niños / Grupo adultos / Aventura / Lujo / Primer viaje / Otro) | Sí | `Primer viaje` |
| Destino(s) | multi-select (Iguazú / Bariloche / Calafate / Ushuaia / Salta-Jujuy / Mendoza / Buenos Aires / Uruguay) | Sí, al menos 1 | `Iguazú` (1 destino) o `Iguazú, Bariloche` (multi) |
| Fecha ida | date | Sí | `2026-08-14` |
| Fecha vuelta | date | Sí | `2026-08-16` |
| Adultos | number (integer, min 1) | Sí | `1` |
| Menores | number (integer, min 0) | Sí | `0` |
| Edades menores | array de numbers (uno por menor) | Solo si menores > 0 | `[8, 12]` |
| Método de pago | select (tarjeta / beetransfer / efectivo) | Sí | `tarjeta` |
| Equipaje | select (carry-on / valija 15 kg / valija 23 kg / 2 valijas / no incluye) | Sí | `carry-on` |
| Aerolínea (opcional, solo si aplica) | text | No | `JetSMART Economy básico` |

## Paso 2 — Vuelos (costos ARS)

Se piden 4 valores (ida/vuelta × adulto/menor). Poner `0` si no aplica (ej: cliente trae vuelos propios, o sin menores).

| Campo | Tipo | Ejemplo |
| --- | --- | --- |
| Vuelo ida — adulto (ARS) | number | `147.500` |
| Vuelo ida — menor (ARS) | number | `0` |
| Vuelo vuelta — adulto (ARS) | number | `147.881` |
| Vuelo vuelta — menor (ARS) | number | `0` |

**Nota:** si `vuelo_ida + vuelo_vuelta = 0` para ambos tipos de PAX → cliente trae vuelos propios → PDF NO muestra sección vuelos (Fase 4.1 regla explícita).

## Paso 3 — Hotel (costos ARS)

| Campo | Tipo | Ejemplo |
| --- | --- | --- |
| Hotel — adulto total estadía (ARS) | number | `399.207` |
| Hotel — menor total estadía (ARS) | number | `0` |
| Nombre hotel (opcional) | text | `Amérian Portal del Iguazú` |
| Categoría hotel (opcional) | select (3★ / 4★ / 5★) | `5★` |
| Régimen (opcional) | text | `Desayuno buffet incluido` |
| Ubicación (opcional) | text | `Puerto Iguazú, 1.91 km del centro` |
| Tipo habitación (opcional) | text | `Doble Estándar con Vista al Jardín` |
| Ajuste operador ARS (opcional, ±) | number | `-47.905` |
| Razón ajuste (opcional) | text | `comisión wholesaler` |

**Nota:** si `hotel = 0` para ambos tipos → paquete sin hotel → PDF omite sección hotel entera.

## Paso 4 — Excursiones (del catálogo Madero)

El vendedor ve la lista filtrada por `Destino` + `Activa=true` + validez de fecha del viaje. Multi-select.

Para cada excursión seleccionada, la app graba: `Nombre`, `Proveedor`, `NETO`, `Moneda` (ARS/USD), `Observaciones`.

**Bloqueadores:**

- Si excursión `Precio menor` está vacía y hay menores → confirmar con vendedor
- Si excursión es "PASE DIARIO CERRO CATEDRAL H1" → mostrar aviso "Sin precio — consultar directamente con el proveedor" y no incluir en el cálculo

## Paso 5 — Confirmación y resumen

Muestra desglose del cálculo (9 pasos ejecutados con los valores del wizard) + resumen:

- Precio final USD (entero, CEILING)
- Precio por adulto USD (entero, CEILING)
- Precio por menor USD (entero, CEILING, si aplica)
- Excursiones incluidas
- Comparativa: costo neto USD → margen agencia → fee → margen vendedor → precio final

Vendedor click **"Generar PDF"** → dispara Cloud Run PDF service.

---

# 4. DATA SOURCES — DBs Notion actuales (migración one-time a Convex)

Todas las DBs viven hoy en el workspace Notion **Madero Viagens > Comercial**. Deben migrarse una única vez a Convex como tablas propias. Después, el panel admin de la app permite editarlas sin volver a Notion.

## 4.1 Config TC + Parámetros de Fórmula

**Notion page ID:** `382d7e4f-683b-811d-9a53-ca28bcd85365`

**URL:** [Config — TC + Parámetros de Cálculo](https://app.notion.com/p/Config-TC-Par-metros-de-C-lculo-382d7e4f683b811d9a53ca28bcd85365?pvs=21)

**Estructura — tabla "TC del Día":**

| Moneda | Par | Tipo de Cambio | Actualizado |
| --- | --- | --- | --- |
| Peso argentino → Dólar | ARS/USD | 1420 | 2026-06-22 |
| Dólar → Sol peruano | USD/PEN | — | — |
| Dólar → Peso colombiano | USD/COP | — | — |
| (etc. — 7 monedas total) |  |  |  |

**Estructura — tabla "Parámetros de Fórmula":**

| Parámetro | Variable | Valor actual | Operación |
| --- | --- | --- | --- |
| Impuesto vuelos | `flight_tax_pct` | 5% | costo ÷ 0,95 |
| Impuesto hotel | `hotel_tax_pct` | 3% | costo ÷ 0,97 |
| Margen agencia | `agency_margin_pct` | 30% | subtotal ÷ 0,70 |
| Fee tarjeta | `card_fee_pct` | 10% | precio × 1,10 |
| Fee BeeTransfer | `beetransfer_fee_pct` | 3% | precio × 1,03 |
| Fee efectivo | `cash_fee_pct` | 0% | × 1,0 (sin ajuste) |
| Margen vendedor | `seller_margin_pct` | 5% | precio_post_fee ÷ 0,95 |

**En Convex esto vive en 2 tablas:**

- `configTC` — TC del día (updated diariamente por admin desde panel)
- `formulaParams` — parámetros (raramente cambian, admin puede editarlos)

## 4.2 DB Excursiones (catálogo — 199 filas)

**Notion database ID:** `384d7e4f-683b-81f7-8ba9-fca0dc2d97e1`

**Data source ID:** `384d7e4f-683b-8109-884b-000bbe79970f`

**URL:** [Excursiones Madero](https://app.notion.com/p/384d7e4f683b81f78ba9fca0dc2d97e1?pvs=21)

**Schema completo (usar como base para tabla Convex `excursiones`):**

| Field | Tipo | Descripción / Valores |
| --- | --- | --- |
| `Nombre` | title (text) | Nombre catálogo. Puede tener prefijos `EXC` , `PQT N ·` y sufijos `— TITO`, `· CARACOL` — ver §7.4 cleaning |
| `Destino` | select | `Iguazú` / `Bariloche` / `Calafate` / `Ushuaia` / `Salta-Jujuy` / `Mendoza` / `Buenos Aires` / `Uruguay` |
| `Proveedor` | text | Nombre proveedor |
| `NETO` | number | Precio adulto en la moneda del row |
| `Moneda` | select | `ARS` o `USD` |
| `Precio menor` | number | Precio menor si difiere (vacío = mismo que adulto) |
| `Activa` | checkbox | Solo mostrar `true` en wizard |
| `Categoría paquete` | select | `Base` / `Upsell` / `Adicional` |
| `Tipo` | select | `Excursión regular` / `Snow experience` / `Servicio adicional` |
| `Horario` | text | Ej. "08:00–13:00" |
| `Días de salida` | text | Ej. "Lunes, Miércoles, Viernes" |
| `Duración` | text | Ej. "5 horas" |
| `Dificultad` | select | `Baja` / `Media` / `Alta` |
| `Incluye` | text | Descripción de qué incluye |
| `Condiciones` | text | Restricciones (ej. refs `(*N)` al tarifario) |
| `Observaciones` | text | Notas internas |
| `Política menores` | select | `Mismo adulto` / `Precio especial` / `No aplica` / `Consultar` |
| `Validez desde` | date | Filtrar en runtime |
| `Validez hasta` | date | Filtrar en runtime |
| `photo_url` | url | Foto para card upsell (si vacío → fondo navy + emoji) |
| `Link ES` / `Link EN` / `Link PT` | url | Links a tarifarios web |
| `Tarifario web` | url | Referencia interna |
| `Fuente sheet` | url | Sheet Google fuente |
| `Ref. verificación` | text | Audit interno |
| `Notas` | text | Notas libres |

## 4.3 DB Tips & Gastro (contenido editorial página 2 del PDF)

**Notion database ID:** `dae4c54d-2869-46d2-866d-537042855155`

**Data source ID:** `a6159d33-9d7d-49ed-9008-16c4b750522f`

**Schema:**

| Field | Tipo | Descripción |
| --- | --- | --- |
| `Title` | title | Nombre del tip / gastro / item |
| `Destino` | select | Igual a DB Excursiones |
| `Temporada` | multi-select | `Verano` / `Otoño` / `Invierno` / `Primavera` / `Todo el año` |
| `Perfil` | multi-select | Igual que perfil cliente + `Cualquier perfil` |
| `Tipo` | select | `Tip` / `Gastronomía` / `Qué llevar` (⚠ `Excursión sugerida` está DEPRECADO) |
| `Description` | text | Contenido a renderizar en PDF |
| `MaderoVende` | checkbox | Si `true` → priorizar para upsell (Madero gana comisión) |
| `MapsURL` | url | Solo para `Gastronomía` — link Google Maps |
| `Validated` | checkbox | `true` = curado; nuevos van con `false` |
| `UsageCount` | number | Contador de veces usado (incrementar en cada uso) |
| `CreatedInCotización` | text | ID de la cotización que lo creó (audit) |

**Determinar temporada** según mes de la fecha de ida:

- Meses 12, 1, 2 → `Verano`
- Meses 3, 4, 5 → `Otoño`
- Meses 6, 7, 8 → `Invierno`
- Meses 9, 10, 11 → `Primavera`

## 4.4 DB Mapas Destinos

**Notion database ID:** `2b24a75d-9fe7-4f34-9103-7d503df42849`

**24 destinos configurados**

**Schema:**

| Field | Tipo | Descripción |
| --- | --- | --- |
| `Destino` | title | Nombre exacto (match con destino del cliente) |
| `Image URL` | url | Imagen del mapa (Drive público) |
| `Maps URL` | url | Deep-link Google Maps interactivo |
| `Summary` | text | Descripción corta del destino (aparece en pág 3 PDF) |
| `Activo` | checkbox | Solo usar `true` |

**Prohibido:** inventar coords, reconstruir URLs Maps, generar mapas en runtime. Si destino nuevo: agregar row a esta DB primero.

## 4.5 DB Cotizaciones (DESTINO de escritura — replicar como tabla Convex `cotizaciones`)

**Notion database ID:** `fc5943af-5d5f-4b47-ba51-28ab56cef2f8`

**Data source ID:** `5087fbf9-6341-4684-b68c-e2f584ba7346`

**Schema completo:**

| Field | Tipo | Origen del valor |
| --- | --- | --- |
| `Nro. Cotización` (title) | text | `COT-XXXX` autoincrement |
| `Lead` | text | Nombre cliente |
| `WhatsApp` | phone | Teléfono cliente |
| `Destino` | text | Destino(s) confirmados |
| `Perfil` | select | Perfil cliente |
| `Fecha Cotización` | date | Hoy |
| `Fecha Envío` | date | Hoy (o cuando vendedor marca "enviada") |
| `PAX Adultos` | number | Del wizard |
| `PAX Niños` | number | Del wizard |
| `Costo Neto USD` | number | `subtotal_usd` Paso 3 (HALF_UP 2dec) |
| `Margen USD` | number | `precio_paquete − subtotal_usd` Paso 4 (HALF_UP 2dec) |
| `Margen Vendedor USD` | number | `precio_final − precio_post_fee` Paso 8 (HALF_UP 2dec) — v2.8 |
| `Precio Final USD` | number | Paso 9 CEILING entero |
| `Precio/Adulto` | number | Paso 9 CEILING entero |
| `Precio/Niño` | number | Paso 9 CEILING entero (si aplica) |
| `Método de Pago` | select | `tarjeta` / `beetransfer` / `efectivo` |
| `TC ARS/USD` | number | TC del día usado |
| `PDF Cliente` | url | Signed URL del PDF en storage |
| `PremiumTag` | checkbox | Ver §7.1 |
| `Redondeo USD` | select | `CEILING_v1` para nuevas |
| `Estado` | select | `borrador` / `enviada` / `convertida` / `rechazada` |
| `Notas` | text | Resumen estructurado — ver formato §6 |
| `Auditoría` | url | Link a subpage con desglose completo (opcional en Convex) |

---

# 5. FÓRMULA v2.8 — 9 pasos (source of truth)

**Reglas absolutas:**

- Usar `decimal.Decimal` (Python) o `Decimal.js` (Node). **Prohibido `float`.**
- Internos (`Costo Neto`, `Margen USD`, `Margen Vendedor USD`) → `ROUND_HALF_UP` a 2 decimales
- Cliente-facing (`Precio Final`, `Precio/Adulto`, `Precio/Niño`) → `ROUND_CEILING` a entero
- Parámetros SIEMPRE leídos de `formulaParams` en runtime — nunca hardcodear divisores

## Paso 1 — ARS → USD

```
vuelo_ida_adulto_usd    = vuelo_ida_adulto_ars    ÷ TC
vuelo_ida_menor_usd     = vuelo_ida_menor_ars     ÷ TC
vuelo_vuelta_adulto_usd = vuelo_vuelta_adulto_ars ÷ TC
vuelo_vuelta_menor_usd  = vuelo_vuelta_menor_ars  ÷ TC
hotel_adulto_usd        = hotel_adulto_ars        ÷ TC
hotel_menor_usd         = hotel_menor_ars         ÷ TC

Para cada excursión:
  si Moneda = ARS: exp_usd = NETO ÷ TC
  si Moneda = USD: exp_usd = NETO
total_experiencias_usd = suma de todos los exp_usd
```

## Paso 2 — Gross-up por componente

```
vuelo_*_adj  = vuelo_*_usd  ÷ (1 - flight_tax_pct)    # ej. ÷ 0,95
hotel_*_adj  = hotel_*_usd  ÷ (1 - hotel_tax_pct)     # ej. ÷ 0,97
exp_adj      = total_experiencias_usd                  # sin gross-up
```

## Paso 3 — Subtotal USD

```
total_pax        = pax_adultos + pax_menores
exp_por_pax      = exp_adj ÷ total_pax
base_adulto      = vuelo_ida_adulto_adj + vuelo_vuelta_adulto_adj + hotel_adulto_adj
base_menor       = vuelo_ida_menor_adj  + vuelo_vuelta_menor_adj  + hotel_menor_adj
subtotal_adultos = (base_adulto + exp_por_pax) × pax_adultos
subtotal_menores = (base_menor  + exp_por_pax) × pax_menores
subtotal_usd     = subtotal_adultos + subtotal_menores
```

## Paso 4 — Margen agencia 30% (v2.8, sin vendedor)

```
precio_paquete     = subtotal_usd ÷ (1 - agency_margin_pct)   # ÷ 0,70
margen_agencia_usd = precio_paquete − subtotal_usd            # → Margen USD (HALF_UP)
```

## Paso 5 — Fee de cobro (MULTIPLICACIÓN v2.8)

```
efectivo:    precio_post_fee = precio_paquete
tarjeta:     precio_post_fee = precio_paquete × (1 + card_fee_pct)         # × 1,10
beetransfer: precio_post_fee = precio_paquete × (1 + beetransfer_fee_pct)  # × 1,03
```

## Paso 6 — Precio por PAX base (sobre precio_post_fee, antes del vendedor)

```
precio_adulto_base = precio_post_fee × (subtotal_adultos ÷ subtotal_usd) ÷ pax_adultos
precio_menor_base  = precio_post_fee × (subtotal_menores ÷ subtotal_usd) ÷ pax_menores
                     (si pax_menores = 0: precio_menor_base = 0)
```

## Paso 7 — Moneda local (opcional)

```
Si vendedor provee TC_USD_LOCAL:
  precio_local = precio_final_cliente × TC_USD_LOCAL   # usar valor del Paso 9
```

## Paso 8 — Margen vendedor 5% AL FINAL (NUEVO v2.8)

```
precio_final         = precio_post_fee ÷ (1 - seller_margin_pct)   # ÷ 0,95
margen_vendedor_usd  = precio_final × seller_margin_pct             # → Margen Vendedor USD (HALF_UP)
                     = precio_final − precio_post_fee

precio_adulto_final  = precio_adulto_base ÷ (1 - seller_margin_pct)   # ÷ 0,95
precio_menor_final   = precio_menor_base  ÷ (1 - seller_margin_pct)   # ÷ 0,95
```

## Paso 9 — Redondeo CEILING_v1 (cliente-facing)

```python
from decimal import Decimal, ROUND_CEILING

def r_ceil(x: Decimal) -> Decimal:
    return x.quantize(Decimal('1'), rounding=ROUND_CEILING)

precio_final_cliente  = r_ceil(precio_final)          # ej. 6992.25 → 6993
precio_adulto_cliente = r_ceil(precio_adulto_final)   # ej. 3496.12 → 3497
precio_menor_cliente  = r_ceil(precio_menor_final)
```

**Side-effect aceptado:** la suma `Costo Neto + Margen + Margen Vendedor + Fees` puede no cuadrar al centavo con `Precio Final` cliente (diferencia ≤ USD 1). Decisión consciente, no bug.

## Ejemplo funcional COT-0007 (Kelly, Iguazú, 1 pax, tarjeta, TC=1420)

**Inputs:** vuelo ida ARS 147.500, vuelo vuelta ARS 147.881, hotel ARS 351.302 (con ajuste operador -47.905), excursiones = Cataratas Arg + Bras (USD 220) + Gran Aventura (USD 85).

| Paso | Valor |
| --- | --- |
| 1. USD | vuelo ida = 103.87, vuelta = 104.14, hotel = 247.40, exc = 305.00 |
| 2. Adj | vuelo ida = 109.34, vuelta = 109.62, hotel = 255.05, exc = 305.00 |
| 3. Subtotal | 779.01 |
| 4. Paquete (÷ 0,70) | 1112.87 (margen agencia 333.86) |
| 5. Post-fee tarjeta (× 1,10) | 1224.15 |
| 6. Adulto base | 1224.15 (1 pax) |
| 8. Post-vendedor (÷ 0,95) | 1288.58 (margen vendedor 64.43) |
| 9. CEILING | **USD 1289** |

Este ejemplo debe reproducirse idéntico en el backend del CTO como test unitario.

---

# 6. REGLAS ESPECIALES (no obvias — leer con cuidado)

## 6.1 Regla Premium

Paquete es **premium** si CUALQUIERA de:

- ≥1 excursión seleccionada con `NETO ≥ USD 200/pax` (convertir ARS→USD primero)
- O `Precio Final USD ≥ 3000`

Si premium → agregar tag `🎖 Paquete premium` al principio del `hero_tags_html` en PDF + flag `PremiumTag=true` en DB.

## 6.2 Single vs Multi-destino (detección automática)

```
destinos_unicos = list(set(d.strip().lower() for d in destinos_confirmados))
if len(destinos_unicos) == 1:
    usar template single (45 placeholders)
else:
    usar template multi (35 placeholders)
```

## 6.3 Cleaning de títulos de excursión (para PDF cliente)

El `Nombre` del catálogo Madero tiene códigos internos que **NO deben mostrarse al cliente** pero **SÍ deben mantenerse en Auditoría interna**.

**Regex de limpieza (aplicar en ese orden):**

1. **Quitar prefijos:** `^(EXC |PQT \d+ · |PQT \d+ |EXC\d+ )`
2. **Quitar sufijos:** `\s*[-—·]\s*(TITO|H1|NITES|CARACOL|VITIVINICOLA|BUS VITIVINICOLA|\(.*\))$`
3. **Quitar `Excursión`  inicial redundante** si el resto queda bien

**Ejemplos:**

- `PQT 05 · Cataratas Arg + Bras + Transfers (REGULAR) — CARACOL` → `Cataratas Arg + Bras + Transfers`
- `EXCURSION GRAN AVENTURA (TITO) — PARA FULL DAY` → `Gran Aventura — Full Day`
- `Full Day Iguazú Privado TITO` → `Full Day Iguazú Privado`

**Regla:** en DB `cotizaciones.excursiones[]` guardar AMBOS — `nombre_original` (para audit) y `nombre_limpio` (para PDF).

## 6.4 Selección de 3 cards de upsell (pág 2 del PDF)

Las 3 cards de "Excursiones disponibles" en la pág 2 son el **menú de upsell** — cosas NO incluidas en el paquete.

**Algoritmo:**

1. Query DB Excursiones filtrado por: `Destino = X` + `Activa = true` + validez fecha
2. `candidatos = todas − las seleccionadas en Paso 4 del wizard`
3. **Regla estricta:**
    - Si `len(candidatos) ≥ 3` → forzar 3 (grid pág 2 desbalancea con menos)
    - Si `len(candidatos) == 1 o 2` → mostrar las que haya
    - Si `len(candidatos) == 0` → warning + placeholder vacío
4. **Ranking cuando > 3 candidatos** (elegir por perfil del cliente):
    - `Familia con niños` → kid-friendly (catamarán, aves, panorámicos)
    - `Pareja` → románticas / gastronómicas
    - `Aventura` → adrenalina (rappel, kayak, trekking alto)
    - `Lujo` → premium (helicóptero, tours privados)
    - `Primer viaje` → must-see (Cataratas, Perito Moreno, Tren Fin del Mundo)
    - `Grupo adultos` → mix social (cervecería, navegación)
    - Tie-breaker: mayor `NETO` gana (upsell premium)

## 6.5 Filtro de Tips (excluir tips redundantes con paquete)

Solo aplica a `Tipo = Tip` (no a Gastronomía ni Qué llevar).

Excluir Tips cuyo `Title` o `Description` mencione una excursión ya incluida (o sinónimos obvios: "Cataratas Argentinas" = "lado argentino" = "PN Iguazú", etc.).

**Priorizar** Tips con `MaderoVende = true` (Madero gana upsell) al top.

## 6.6 Emoji por destino (para sección "Experiencias incluidas por destino")

- 🧊 Bariloche / Calafate (glaciar/lago patagónico)
- 🐧 Ushuaia
- 💧 Iguazú
- 🍷 Mendoza
- 🏜 Salta-Jujuy
- 🌆 Buenos Aires
- Otros: emoji representativo

## 6.7 Reglas del `flights_section_html`

- **Vacío SOLO si TODOS los vuelos son propios del cliente** (todos los inputs vuelos = 0)
- **Si al menos 1 tramo tiene precio > 0** → SIEMPRE mostrar sección con esos vuelos
- Bug histórico prohibido: agente omitió vuelos AEP-IGR asumiendo "cliente ya tiene internacional"

## 6.8 Reglas del `includes_excludes_html` — línea equipaje

**Siempre incluir línea de equipaje** (crítico para vuelos low-cost):

| Equipaje | Línea en PDF |
| --- | --- |
| `carry-on` | `✅ Equipaje de mano 10 kg (JetSMART Economy básico — sin valija despachada)` |
| `valija 15 kg` | `✅ 1 valija despachada hasta 15 kg + equipaje de mano` |
| `valija 23 kg` | `✅ 1 valija despachada hasta 23 kg + equipaje de mano` |
| `2 valijas` | `✅ 2 valijas despachadas + equipaje de mano` |
| `no incluye` | `❌ Equipaje despachado no incluido — cliente compra aparte en aeropuerto o web aerolínea` |

Omitir línea solo si NO hay vuelos en el paquete.

## 6.9 Reglas de placeholders `total_price` + `pax_count` + `_sub`

**Prohibido duplicar contenido.** Bugs históricos:

- `total_price` = solo número con formato miles, SIN "USD" (el template ya lo tiene hardcoded). Ej: `"1.289"`, NO `"USD 1.289"`.
- `total_price_sub` = NUNCA repetir el monto. Solo contexto. Ej: si 1 pax → `"Por persona"`. Si >1 pax → `"USD X / persona · N pax"`.
- `pax_count` = string completo. Ej: `"2 adultos"`, NO `"2"`.
- `pax_sub` = NUNCA repetir. Si sin menores → `"Sin menores"`. Si con menores → `"Edades: 8, 12"`.

## 6.10 Numeración COT-XXXX

- Autoincrement basado en la última cotización de la tabla `cotizaciones`
- Formato zero-padded a 4 dígitos: `COT-0001`, `COT-0002`, ..., `COT-9999`
- Se asigna en Paso 1 del wizard y NO cambia aunque el vendedor recalcule
- Cotizaciones `COT-0001` a `COT-0006` usaron fórmula vieja v2.7 (margen 35%, fees ÷) — NO retroactivar

---

# 7. PDF — Estructura, templates y placeholders

## 7.1 Templates disponibles

**Single (1 destino) — `template_single_v26.html`** — 45 placeholders, 24 KB

**Multi (2+ destinos) — `template_multi_v1.html`** — 35 placeholders, 17 KB

Ambos comparten el CSS bloque `:root` (BRAND TOKENS — deben mantenerse en sync). Si cambia branding, actualizar los DOS templates a la vez.

## 7.2 Placeholders SINGLE (template_single_v26.html)

```
{{calendly_url}} {{client_name}} {{clima_desc}} {{clima_icon}} {{clima_season}}
{{clima_temp}} {{clima_title}} {{cot_number}} {{date_formatted}} {{departure_date}}
{{departure_dow}} {{destination}} {{destination_loc}} {{destino_summary}}
{{excursions_html}} {{experiencias_incluidas_html}} {{flights_section_html}}
{{footer_contact}} {{footer_email}} {{footer_whatsapp}} {{hero_tags_html}}
{{hotel_section_html}} {{hotel_stars_label}} {{includes_excludes_html}}
{{itinerary_html}} {{logo_data_url}} {{map_image_url}} {{map_link_url}}
{{nights_label}} {{p2_sub}} {{packing_html}} {{packing_section_title}}
{{pax_count}} {{pax_label}} {{pax_sub}} {{payment_method}} {{payment_method_desc}}
{{price_per_person}} {{return_date}} {{return_dow}} {{tips_gastro_html}}
{{total_price}} {{total_price_sub}} {{valid_until_full}} {{valid_until_short}}
```

## 7.3 Placeholders MULTI (template_multi_v1.html)

```
{{calendly_url}} {{client_name}} {{cot_number}} {{date_formatted}} {{departure_date}}
{{departure_dow}} {{destination}} {{destination_loc}} {{destination_short}}
{{excursions_upsell_html}} {{experiencias_incluidas_html}} {{flights_section_html}}
{{footer_email}} {{footer_whatsapp}} {{footer_whatsapp_link}} {{hero_tags_html}}
{{hotels_section_html}} {{hotels_summary}} {{includes_excludes_html}} {{itinerary_html}}
{{logo_data_url}} {{maps_section_html}} {{nights_label}} {{pax_count}} {{pax_sub}}
{{payment_method}} {{payment_method_desc}} {{return_date}} {{return_dow}}
{{tips_gastro_html}} {{total_price}} {{total_price_sub}} {{valid_until_short}}
```

## 7.4 Estructura del PDF (single, 2-3 páginas)

**Página 1 — Hero + Info-strip + Vuelos + Hotel + ¿Qué incluye? + Itinerario**

- Logo Madero (top left, PNG blanco base64)
- Hero: cliente, destino, fechas, PRECIO FINAL grande
- Tags premium/perfil
- Info-strip: PAX, noches, método de pago, precio/persona
- Sección vuelos (cards horizontales — 1 por tramo cotizado)
- Sección hotel (nombre, categoría, régimen, ubicación, ajuste operador)
- ¿QUÉ INCLUYE? (bullets con ✅/❌, incluye SIEMPRE línea equipaje)
- Itinerario día por día (bullets con actividades por día)

**Página 2 — Experiencias incluidas + Upsell + Tips + Gastronomía + Qué llevar**

- Sección "Experiencias incluidas por destino" (agrupadas por destino con emoji)
- 3 cards de upsell (excursiones NO incluidas, con foto/emoji, precio USD/pax, descripción)
- Tips (del DB Tips&Gastro filtrado, priorizando MaderoVende)
- Gastronomía (con link Google Maps por cada uno)
- Qué llevar

**Página 3 — Mapa destino + CTA Calendly + Contacto**

- Mapa estático del destino (Image URL de DB Mapas, click → Maps URL)
- Descripción destino (Summary de DB Mapas)
- CTA: agendar llamada con Madero (Calendly URL)
- Footer: WhatsApp `+54 9 11 4444-1111` + email `contacto@maderoviagens.com`

## 7.5 Generación técnica

- **Tecnología:** Playwright + Chromium standalone (headless)
- **Trigger:** desde Next.js API route → POST HTTP a Cloud Run service
- **Cloud Run service:** container Docker con Node/Python + Playwright + templates + logo montados como volumen o embebidos
- **Input al service:** JSON con todos los placeholders resueltos + template mode (`single` / `multi`)
- **Output del service:** PDF binary (subir a Firebase Storage o retornar bytes)
- **Timing esperado:** ~5s (Chromium warm), ~15s (cold start)
- **Fallbacks obligatorios:** si generación falla, no crear registro en `cotizaciones`, avisar al vendedor con mensaje claro

---

# 8. STORAGE del PDF — naming y organización

**Actual (skill v2.8):**

- Local: `~/Desktop/Madero Viagens : Proyect/PDF - Cotizaciones Clientes/YYYY-MM/COT-XXXX_cliente.pdf`
- Drive: `PDF-Cotizaciones-cliente-whatsapp/YYYY-MM/COT-XXXX_cliente.pdf` (folder ID `1fpoL_0N5SNL8MaJGJSozcySuw0EkHp5u`)

**Propuesto (web app):**

Opción A — **Firebase Storage** (simple, recomendado):

- Path: `cotizaciones/YYYY-MM/COT-XXXX_cliente.pdf`
- Access: signed URL con expiración 30 días
- Un solo bucket, indexado por mes

Opción B — **Google Drive Madero corporativo** (mantiene el flujo actual):

- Requiere OAuth service account con acceso al folder
- Path replica el actual: `PDF-Cotizaciones-cliente-whatsapp/YYYY-MM/COT-XXXX_cliente.pdf`
- Ventaja: alguien puede entrar a Drive y ver PDFs sin abrir la app
- Desventaja: dependencia OAuth + refresh tokens

**Naming:**

- Formato: `COT-{NNNN}_cliente.pdf`
- NO incluir nombre del cliente en el filename (privacidad)
- El link se guarda en `cotizaciones.pdfClienteUrl`

---

# 9. CONSTANTES FIJAS (hardcoded, no dependen de DB)

| Constante | Valor | Notas |
| --- | --- | --- |
| `calendly_url` | `https://calendly.com/madero-viagens` | Placeholder — confirmar link real con Madero |
| `footer_whatsapp` | `+54 9 11 4444-1111` | WhatsApp Madero (confirmar) |
| `footer_email` | `contacto@maderoviagens.com` | Email Madero (confirmar) |
| `SIG_THRESHOLD_PREMIUM_EXC` | `USD 200/pax` | Umbral excursión premium |
| `SIG_THRESHOLD_PREMIUM_TOTAL` | `USD 3000` | Umbral total premium |
| `SELLER_MARGIN_PCT` fallback | `0.05` (5%) | Solo si formulaParams está roto |
| `VALIDEZ_COTIZACION_DIAS` | `7` | Cotización vigente 7 días desde emisión |

---

# 10. VALIDATION GATES (errores que deben bloquear el flujo)

| Condición | Mensaje al vendedor |
| --- | --- |
| TC del día vacío en `configTC` | `⛔ TC del día no actualizado. Avisar al admin.` |
| Parámetro de fórmula vacío / no numérico | `⛔ Parámetro [nombre] inválido en Config. Contactar admin.` |
| Destino no matchea DB Mapas | `⛔ Destino "[X]" no encontrado en catálogo. Agregar antes de continuar.` |
| DB Mapas row `Activo = false` | `⚠ Mapa del destino no disponible. PDF se generará sin sección mapa.` |
| Excursión seleccionada sin `NETO` | `⛔ Excursión sin precio: [nombre]. Consultar proveedor.` |
| PAX adultos = 0 | `⛔ Al menos 1 adulto obligatorio.` |
| Fecha vuelta < fecha ida | `⛔ Fecha vuelta debe ser posterior a fecha ida.` |
| Menores > 0 pero sin edades | `⛔ Especificar edades de los menores.` |
| Cloud Run PDF service down | `⛔ Servicio PDF no disponible. Cotización guardada como borrador — reintentar en 1 minuto.` |

---

# 11. FLUJO END-TO-END (secuencia técnica)

```
1. Vendedor login → Convex Auth con Google Workspace
2. Wizard 5 pasos → estado local (draft en Convex tabla `drafts` cada 30s)
3. Click "Generar cotización":
   a. Backend Convex asigna COT-XXXX autoincrement
   b. Lee configTC + formulaParams (cache 5 min OK)
   c. Ejecuta fórmula 9 pasos con Decimal → obtiene todos los precios
   d. Query DB Mapas + Tips&Gastro para armar payload de PDF
   e. Aplica reglas cleaning, upsell selection, single/multi detection, premium
   f. Construye JSON completo con todos los placeholders resueltos
   g. POST HTTP a Cloud Run PDF service con payload
   h. Cloud Run responde con PDF binary
   i. Backend sube PDF a Storage → obtiene signed URL
   j. Backend escribe row en tabla `cotizaciones` con todos los campos
   k. Backend devuelve al frontend: signed URL + resumen cotización
4. Frontend muestra: "✅ Cotización COT-XXXX lista" + botón "Descargar PDF" + botón "Copiar link"
5. Vendedor descarga PDF, lo manda por su WhatsApp
6. Opcional: vendedor vuelve a la app y marca "enviada"
```

---

# 12. TABLAS CONVEX NECESARIAS (schema propuesto)

```tsx
// convex/schema.ts

users: {
  email: string,
  name: string,
  role: "admin" | "vendedor",
  active: boolean,
  createdAt: number,
}

configTC: {
  pair: string,           // "ARS/USD", "USD/PEN", etc.
  rate: number,
  updatedAt: number,
  updatedBy: id("users"),
}

formulaParams: {
  key: string,            // "flight_tax_pct", "agency_margin_pct", etc.
  value: number,          // como decimal, ej. 0.30
  updatedAt: number,
}

excursiones: {
  nombre: string,
  destino: string,        // enum
  proveedor: string,
  neto: number,
  moneda: "ARS" | "USD",
  precioMenor: number | null,
  activa: boolean,
  categoria: "Base" | "Upsell" | "Adicional",
  tipo: string,
  horario: string,
  diasSalida: string,
  duracion: string,
  dificultad: "Baja" | "Media" | "Alta" | null,
  incluye: string,
  condiciones: string,
  observaciones: string,
  politicaMenores: string,
  validezDesde: number,   // timestamp
  validezHasta: number,   // timestamp
  photoUrl: string | null,
  notionId: string,       // referencia para tracking
}

mapasDestinos: {
  destino: string,
  imageUrl: string,
  mapsUrl: string,
  summary: string,
  activo: boolean,
}

tipsGastro: {
  title: string,
  destino: string,
  temporada: string[],    // multi
  perfil: string[],       // multi
  tipo: "Tip" | "Gastronomía" | "Qué llevar",
  description: string,
  maderoVende: boolean,
  mapsUrl: string | null,
  validated: boolean,
  usageCount: number,
  createdInCotizacion: string | null,
}

cotizaciones: {
  nroCotizacion: string,  // "COT-0007"
  vendedorId: id("users"),
  lead: string,
  whatsapp: string,
  paisOrigen: string,
  destinos: string[],
  perfil: string,
  fechaCotizacion: number,
  fechaEnvio: number | null,
  fechaIda: number,
  fechaVuelta: number,
  paxAdultos: number,
  paxMenores: number,
  edadesMenores: number[],
  equipaje: string,
  aerolinea: string | null,
  metodoPago: "tarjeta" | "beetransfer" | "efectivo",

  // Inputs originales (audit)
  vueloIdaAdultoArs: number,
  vueloIdaMenorArs: number,
  vueloVueltaAdultoArs: number,
  vueloVueltaMenorArs: number,
  hotelAdultoArs: number,
  hotelMenorArs: number,
  hotelNombre: string | null,
  hotelCategoria: string | null,
  hotelRegimen: string | null,
  hotelAjusteArs: number | null,
  hotelAjusteRazon: string | null,

  // Excursiones seleccionadas
  excursiones: {
    excursionId: id("excursiones"),
    nombreOriginal: string,   // para audit
    nombreLimpio: string,     // para PDF
    proveedor: string,
    neto: number,
    moneda: "ARS" | "USD",
    observaciones: string | null,
  }[],

  // Snapshot cálculo v2.8 (audit)
  tcUsadoArsUsd: number,
  parametrosSnapshot: { flightTaxPct: number, hotelTaxPct: number, ... },
  costoNetoUsd: number,          // HALF_UP 2dec
  margenAgenciaUsd: number,      // HALF_UP 2dec
  margenVendedorUsd: number,     // HALF_UP 2dec
  precioFinalUsd: number,        // CEILING entero
  precioAdultoUsd: number,       // CEILING entero
  precioMenorUsd: number,        // CEILING entero
  precioLocal: number | null,    // Paso 7 opcional
  tcLocal: number | null,

  // Metadata
  premiumTag: boolean,
  redondeoUsd: "CEILING_v1",
  templateMode: "single" | "multi",
  estado: "borrador" | "enviada" | "convertida" | "rechazada",
  pdfClienteUrl: string,
  pdfStoragePath: string,
  notas: string,
  createdAt: number,
  updatedAt: number,
}

drafts: {
  // Estado del wizard en progreso (autosave)
  vendedorId: id("users"),
  wizardState: any,       // JSON con el estado del wizard
  lastUpdated: number,
}
```

---

# 13. DASHBOARD READ-ONLY (para admin y vendedores)

**Vendedores:**

- Sus últimas 20 cotizaciones (COT-XXXX, cliente, destino, fecha, precio USD, estado, link PDF)
- Total cotizado del mes (USD)
- Botón "Marcar como enviada / convertida / rechazada"

**Admin (Kristhian):**

- Todas las cotizaciones del mes
- Ranking vendedores (cantidad + monto)
- Top destinos cotizados
- Conversión (cotizaciones convertidas / total)
- Margen total agencia + margen total vendedor (para liquidar comisiones)
- Panel edición: `configTC` (TC diario), `formulaParams`, `excursiones` (activar/desactivar, editar precios), `mapasDestinos`, `tipsGastro`

---

# 14. TESTING obligatorio antes de go-live

## 14.1 Tests unitarios cálculo

Cada cotización histórica `COT-0007` en adelante (las v2.8) debe reproducirse **idéntica** con la nueva implementación. Test data disponible en Notion DB Cotizaciones.

## 14.2 Tests PDF visual

Comparar PDF generado por la app vs PDF generado por el skill actual con los mismos inputs. Debe ser byte-idéntico (o al menos visualmente indistinguible — mismo layout, mismos colores, mismos placeholders resueltos).

## 14.3 Test paralelo (2 semanas)

Vendedores cotizan 1 mismo caso con AMBOS sistemas (skill Claude + app web). Comparar resultados. Bugs se corrigen antes de retirar el skill.

## 14.4 Load test

Simular 50 cotizaciones/hora durante 1 hora. Verificar que Cloud Run PDF service no colapsa (auto-scale funciona) y Convex maneja las escrituras.

---

# 15. REFERENCIAS — archivos actuales para el CTO

| Archivo | Path | Propósito |
| --- | --- | --- |
| Skill [SKILL.md](http://SKILL.md) | `~/.claude/skills/cotizar-madero/SKILL.md` | Documentación completa de lógica v2.8 (958 líneas) |
| Template single | `~/.claude/skills/cotizar-madero/templates/template_single_v26.html` | HTML/CSS con placeholders (24 KB) |
| Template multi | `~/.claude/skills/cotizar-madero/templates/template_multi_v1.html` | HTML/CSS con placeholders (17 KB) |
| Logo base64 | `~/.claude/skills/cotizar-madero/assets/madero_logo_white.b64` | ~63 KB base64 PNG blanco |
| Helper Decimal | `~/.claude/skills/cotizar-madero/scripts/calculo_7_pasos.py` | Funciones `r()` HALF_UP y `r_ceil()` CEILING |
| PDF renderer | `~/.claude/skills/cotizar-madero/scripts/html_to_pdf_playwright.py` | Playwright standalone |
| Backup GitHub | `github.com/kristhiancardenas2020-ui/agency-madero` | Folder `skills/cotizar-madero/` |
| Config TC Notion | [Config — TC + Parámetros de Cálculo](https://app.notion.com/p/Config-TC-Par-metros-de-C-lculo-382d7e4f683b811d9a53ca28bcd85365?pvs=21) | TC + parámetros fórmula |
| DB Excursiones Notion | [Excursiones Madero](https://app.notion.com/p/384d7e4f683b81f78ba9fca0dc2d97e1?pvs=21) | 199 filas catálogo |
| DB Cotizaciones Notion | [Cotizaciones](https://app.notion.com/p/fc5943af5d5f4b47ba5128ab56cef2f8?pvs=21) | Historial COT-0001 en adelante |

---

# 16. Preguntas abiertas para el CTO

1. **Convex o Firestore final?** (recomendación: Convex por menos consolas para no-técnico + TypeScript end-to-end)
2. **Cloud Run vs Railway** para el servicio PDF? (Cloud Run recomendado: scale-to-zero + free tier)
3. **Storage PDF:** Firebase Storage (simple) vs Google Drive Madero (mantiene flujo actual — requiere OAuth service account)
4. **Migración one-time:** ¿por destino con validación humana, o de una vez todo?
5. **Dashboard v1:** ¿mínimo viable (5 métricas) o completo desde día 1?
6. **Autosave del wizard:** cada X segundos a Convex, o solo al submit?
7. **Multi-tenancy:** ¿arquitectar desde ahora para poder vender la app a otras agencias, o Madero-only?
8. **Rollback strategy:** si un bug rompe el cálculo, ¿cómo detectamos + corregimos rápido?

---

*Documento generado a partir de análisis del skill `/cotizar-madero` v2.8 (2026-06-24 PM) — actualizado 2026-07-16*

*Estimación de trabajo del CTO: 3-4 semanas MVP (backend + PDF service + wizard + admin básico) + 2 semanas testing paralelo con skill actual antes de go-live*