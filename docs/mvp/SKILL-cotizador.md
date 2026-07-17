Genera una cotización para un cliente de Madero Viagens desde contexto WhatsApp.

**Fuentes:**

- Precios excursiones: DB Notion `384d7e4f-683b-81f7-8ba9-fca0dc2d97e1`
- TC del día + fórmula: Config TC Notion `382d7e4f-683b-811d-9a53-ca28bcd85365`
- Agente v1 Diseño: `382d7e4f-683b-8101-9316-cd8bcf91440b`

---

## Fase 0 — Leer Contexto WhatsApp

Corre siempre. No requiere input adicional del operador más allá del contexto provisto al invocar el skill.

Extraer del texto o descripción WhatsApp:

- Nombre del cliente
- Destino (Bariloche / Ushuaia / Salta-Jujuy / Mendoza / Calafate / Iguazú)
- PAX: adultos y menores con edades si se mencionan
- Fechas tentativas de viaje
- Excursiones o actividades mencionadas
- Método de pago (si se menciona: efectivo / tarjeta / BeeTransfer)
- **Perfil del cliente:** inferir del contexto. Opciones: `Pareja` / `Familia con niños` / `Grupo adultos` / `Aventura` / `Lujo` / `Primer viaje` / `Otro`. Si no es claro, marcar `no especificado — confirmar` y preguntar en Fase 1.

Mostrar bloque estructurado:

```
CLIENTE:    [nombre o "no especificado"]
DESTINO:    [destino o "no especificado"]
PAX:        [N adultos, M menores (edades: X, Y)] o [N adultos]
FECHAS:     [fechas o "no especificadas"]
INTERESES:  [lista de excursiones/actividades mencionadas o "sin especificar"]
PAGO:       [método o "confirmar con operador"]
```

Datos no presentes en el contexto: marcar como "no especificado" y continuar.

---

## Fase 1 — Confirmar Datos del Cliente

Mostrar el bloque de Fase 0 y pedir confirmación explícita al operador. **STOP — esperar respuesta.**

Siempre confirmar los 4 obligatorios aunque parezcan claros del contexto:

- **Nombre** (requerido)
- **Destino** (requerido — define qué excursiones mostrar)
- **PAX** (requerido: adultos + menores)
- **Perfil** (requerido — define qué tips/gastro/exc-sugeridas matchear en DB Tips & Gastro)

Si el operador corrige algún dato, actualizar y mostrar bloque corregido.

Asignar número de cotización:

- Consultar DB Cotizaciones (`fc5943af-5d5f-4b47-ba51-28ab56cef2f8`) para obtener el último COT asignado
- Formato: `COT-XXXX` (incrementar en +1 sobre el último)
- Si no hay cotizaciones previas: `COT-0001`

Confirmar en output:

```
✅ COTIZACIÓN: COT-XXXX
Cliente:  [nombre]
Destino:  [destino]
PAX:      [N adultos, M menores]
Fechas:   [fechas]
```

---

## Fase 2 — TC del Día + Parámetros de Fórmula

Leer Config TC page vía Notion MCP: `382d7e4f-683b-811d-9a53-ca28bcd85365` (una sola llamada `notion-fetch`).

**A) Extraer TC del día** (tabla "TC del Día", fila ARS/USD):

- Si valor = `—` o vacío: STOP. Alertar: `"TC del día no actualizado. Actualizar ARS/USD en Config TC antes de continuar."`
- Si presente: guardar `TC = [valor numérico]`

**B) Extraer Parámetros de Fórmula** (tabla "Parámetros de Fórmula", columna "Valor actual"):

- `flight_tax_pct` (Impuesto vuelos, ej. 5% → 0.05) → divisor: `1 - flight_tax_pct` (ej. 0.95)
- `hotel_tax_pct` (Impuesto hotel, ej. 3% → 0.03) → divisor: `1 - hotel_tax_pct` (ej. 0.97)
- `agency_margin_pct` (Margen agencia, ej. 35% → 0.35) → divisor: `1 - agency_margin_pct` (ej. 0.65)
- `card_fee_pct` (Fee tarjeta, ej. 10% → 0.10) → divisor: `1 - card_fee_pct` (ej. 0.90)
- `beetransfer_fee_pct` (Fee BeeTransfer, ej. 3% → 0.03) → divisor: `1 - beetransfer_fee_pct` (ej. 0.97)
- `cash_fee_pct` (Fee efectivo, ej. 0%) → sin divisor (precio final = precio_paquete)

Si algún parámetro está vacío o no es numérico: STOP. Alertar: `"Parámetro [nombre] inválido en Config TC. Verificar valor."`

**Single source of truth:** estos valores se usan TAL CUAL en Fase 3. **Nunca hardcodear** divisores en el cálculo — si Config TC cambia, el agente debe usar el nuevo valor sin tocar SKILL.md.

Output:

```
TC del día: 1 USD = [TC] ARS
Parámetros cargados: vuelos +[X]%, hotel +[Y]%, margen [Z]%, fee tarjeta [W]%, fee beetransfer [V]%
```

---

## Fase 3 — Selección de Excursiones y Cálculo

### 3.1 — Mostrar excursiones disponibles

Consultar DB Excursiones vía Notion MCP `384d7e4f-683b-81f7-8ba9-fca0dc2d97e1`:

- Filter: `Destino = [destino confirmado en Fase 1]`
- Filter: `Activa = true`
- Si el cliente tiene fechas: Filter `Validez desde ≤ fecha_viaje ≤ Validez hasta`

Por cada excursión mostrar:

```
[N] [Nombre] — [Proveedor] | NETO: [valor] [Moneda] | [Horario] | [Días de salida]
    Validez: [desde] al [hasta]
    [Condiciones si existe] | [Política menores si existe]
```

**STOP — operador selecciona excursiones por número.**

Registrar para cada seleccionada: Nombre, NETO, Moneda (ARS o USD), Proveedor, Observaciones.

Si selecciona PASE DIARIO CERRO CATEDRAL H1: alertar `"Sin precio — consultar directamente con el proveedor."` y no incluir en el cálculo.

### 3.2 — Costos adicionales (vuelos y hotel)

Solicitar al operador si el paquete incluye vuelos y/o hotel:

```
Vuelo ida   adulto: ___ ARS   (0 si no incluye)
Vuelo ida   menor:  ___ ARS   (0 si no incluye)
Vuelo vuelta adulto: ___ ARS  (0 si no incluye)
Vuelo vuelta menor:  ___ ARS  (0 si no incluye)
Hotel adulto (total estadía): ___ ARS  (0 si no incluye)
Hotel menor  (total estadía): ___ ARS  (0 si no incluye)
Método de pago: efectivo / tarjeta / BeeTransfer
```

**STOP — esperar valores del operador.**

### 3.3 — Conversión de excursiones a USD

Para cada excursión seleccionada:

- Si `Moneda = ARS`: `exp_usd = NETO ÷ TC`
- Si `Moneda = USD`: `exp_usd = NETO` (no dividir por TC)

`total_experiencias_usd = suma de todos los exp_usd`

### 3.4 — Cálculo inline (7 pasos)

Referencia completa: Config TC `382d7e4f-683b-811d`, sección "Fórmula Completa (7 Pasos)".

Usar ROUND_HALF_UP a 2 decimales en el resultado final.

**Paso 1 — ARS → USD**

```
vuelo_ida_adulto_usd    = vuelo_ida_adulto_ars    ÷ TC
vuelo_ida_menor_usd     = vuelo_ida_menor_ars     ÷ TC
vuelo_vuelta_adulto_usd = vuelo_vuelta_adulto_ars ÷ TC
vuelo_vuelta_menor_usd  = vuelo_vuelta_menor_ars  ÷ TC
hotel_adulto_usd        = hotel_adulto_ars        ÷ TC
hotel_menor_usd         = hotel_menor_ars         ÷ TC
(experiencias ya están en USD desde 3.3)
```

**Paso 2 — Gross-up por componente**

```jsx
vuelo_*_adj   = vuelo_*_usd   ÷ (1 - flight_tax_pct)   # divisor desde Config TC (ej. ÷ 0.95 si flight_tax_pct = 5%)
hotel_*_adj   = hotel_*_usd   ÷ (1 - hotel_tax_pct)    # divisor desde Config TC (ej. ÷ 0.97 si hotel_tax_pct = 3%)
exp_adj       = total_experiencias_usd                   # sin gross-up de componente
```

**Paso 3 — Subtotal USD**

```
total_pax        = pax_adultos + pax_menores
exp_por_pax      = exp_adj ÷ total_pax
base_adulto      = vuelo_ida_adulto_adj + vuelo_vuelta_adulto_adj + hotel_adulto_adj
base_menor       = vuelo_ida_menor_adj  + vuelo_vuelta_menor_adj  + hotel_menor_adj
subtotal_adultos = (base_adulto + exp_por_pax) × pax_adultos
subtotal_menores = (base_menor  + exp_por_pax) × pax_menores
subtotal_usd     = subtotal_adultos + subtotal_menores
```

**Paso 4 — Margen agencia** (desde Config TC, default 35%)

```jsx
precio_paquete = subtotal_usd ÷ (1 - agency_margin_pct)   # divisor desde Config TC (ej. ÷ 0.65 si agency_margin_pct = 35%)
```

**Paso 5 — Fee de cobro**

```jsx
efectivo:    precio_final = precio_paquete                                  # cash_fee_pct = 0%
tarjeta:     precio_final = precio_paquete ÷ (1 - card_fee_pct)             # divisor desde Config TC (ej. ÷ 0.90)
beetransfer: precio_final = precio_paquete ÷ (1 - beetransfer_fee_pct)      # divisor desde Config TC (ej. ÷ 0.97)
```

**Paso 6 — Precio por PAX**

```
precio_adulto = precio_final × (subtotal_adultos ÷ subtotal_usd) ÷ pax_adultos
precio_menor  = precio_final × (subtotal_menores ÷ subtotal_usd) ÷ pax_menores
               (si pax_menores = 0: precio_menor = 0)
```

**Paso 7 — Moneda local (opcional)**

```
Si el operador provee TC_USD_LOCAL:
precio_local = precio_final × TC_USD_LOCAL
```

Mostrar desglose:

```
COTIZACIÓN COT-XXXX — [Destino]
─────────────────────────────────────
TC del día: 1 USD = [TC] ARS

COMPONENTES (USD):
  Vuelos (adultos):         $ ...
  Vuelos (menores):         $ ...
  Hotel (adultos):          $ ...
  Hotel (menores):          $ ...
  Excursiones (÷ pax):     $ ...
  ──────────────────────────────
  Subtotal:                 $ [subtotal_usd]
  Margen 35%:             + $ ...
  Precio paquete:           $ [precio_paquete]
  Fee [método]:           + $ ...
─────────────────────────────────────
PRECIO FINAL:               $ [precio_final] USD
Adulto:                     $ [precio_adulto] USD
Menor:                      $ [precio_menor] USD (si aplica)

EXCURSIONES:
  - [Nombre] ([Proveedor]) — [NETO] [Moneda]
```

**STOP — operador aprueba o pide ajustes.** Si pide ajustes → volver a 3.1.

---

## Fase 4 — PDF Cliente

Generar PDF local con Chrome headless y subir a Google Drive **organizado por mes** vía rclone.

Ambos almacenamientos (local Desktop + Drive) usan subcarpeta mensual con formato ISO `YYYY-MM` (ej. `2026-06`). Si la subcarpeta del mes no existe, se crea automáticamente.

Antes de generar el PDF, conseguir el contenido contextual (Tips, Gastronomía, Excursiones sugeridas, Qué llevar) y evaluar la regla premium.

**Paso 4.0 — Query Tips & Gastro DB + Reasoning + Writeback**

DB: `dae4c54d-2869-46d2-866d-537042855155` (Tips & Gastro Madero).

**Determinar temporada** según mes del viaje: 12,1,2=Verano / 3,4,5=Otoño / 6,7,8=Invierno / 9,10,11=Primavera.

**Para CADA tipo** (`Tip`, `Gastronomía`, `Excursión sugerida`, `Qué llevar`):

1. Query DB filtrado por Destino + Temporada (contains o `Todo el año`) + Perfil (contains o `Cualquier perfil`) + Tipo, ordenado Validated=true primero, UsageCount desc.
2. Si ≥3 entries: usar. Si <3: completar con reasoning del agente (MEMORY.md + contexto WhatsApp + destino/temporada/perfil).
3. Para entries NUEVOS de reasoning: write con `notion-create-pages` a data_source `a6159d33-9d7d-49ed-9008-16c4b750522f` con `Validated=false`, `UsageCount=1`, `CreatedInCotización=[COT page_id]`.
4. Para entries existentes usados: increment `UsageCount` via `notion-update-page` update_properties.

**Paso 4.0b — Evaluar Regla Premium**

Paquete es premium si: ≥1 excursión NETO ≥USD 200/pax OR Total final ≥USD 3000.

Si premium=True: agregar tag `<span class="htag gd">🎖 Paquete premium</span>` al inicio de `hero_tags_html`. Si premium=False: omitir.

**Paso 4.1 — Generar PDF**

1. Fetch template HTML desde Notion MCP — page `385d7e4f-683b-8125-af09-d1360f81163c` (PDF Template HTML — Source v2.1). Extraer el contenido del primer bloque de código con lenguaje `html`.
2. Inyectar datos del cliente: nombre, COT-XXXX, destino, fechas, valid-until (fecha cotización + 7 días), excursiones seleccionadas, precio total USD, precio adulto, precio menor
3. Guardar HTML poblado en `/tmp/COT-XXXX_cliente.html`
4. Determinar mes actual: `MONTH=$(date +%Y-%m)` (ej. `2026-06`)
5. Asegurar subcarpeta mensual local con `mkdir -p "/Users/kristucho/Desktop/Madero Viagens : Proyect/PDF - Cotizaciones Clientes/$MONTH"` (no falla si ya existe)
6. Generar PDF con Chrome headless al path mensual:

```jsx
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless \
  --print-to-pdf="/Users/kristucho/Desktop/Madero Viagens : Proyect/PDF - Cotizaciones Clientes/$MONTH/COT-XXXX_cliente.pdf" \
  --no-pdf-header-footer \
  "file:///tmp/COT-XXXX_cliente.html"
```

Confirmar que el archivo PDF existe en la subcarpeta mensual local (Paso 7 del flujo).

**Paso 4.2 — Subir a Google Drive (organizado por mes)**

1. Buscar subcarpeta `{MONTH}` dentro de Drive folder padre `1fpoL_0N5SNL8MaJGJSozcySuw0EkHp5u` con `mcp__claude_ai_Google_Drive__search_files` (query por nombre `{MONTH}`, verificar que el parent sea el folder padre Madero)
2. **Si NO existe** la subcarpeta del mes: crearla con `mcp__claude_ai_Google_Drive__create_file`:
    - `folderId`: `1fpoL_0N5SNL8MaJGJSozcySuw0EkHp5u` (padre)
    - `fileName`: `{MONTH}` (ej. `2026-06`)
    - `mimeType`: `application/vnd.google-apps.folder`
    - Guardar `id` retornado como `month_folder_id`
3. **Si SI existe**: usar su `id` como `month_folder_id`
4. Subir el PDF a la subcarpeta del mes con `mcp__claude_ai_Google_Drive__create_file`:
    - `folderId`: `month_folder_id`
    - `fileName`: `COT-XXXX_cliente.pdf`
    - `mimeType`: `application/pdf`
    - `base64Content`: contenido del PDF en base64
5. Guardar `viewUrl` del response como `pdf_drive_url`.

**Paso 4.3 — Output al operador**

```jsx
✅ PDF generado: /Users/kristucho/Desktop/Madero Viagens : Proyect/PDF - Cotizaciones Clientes/$MONTH/COT-XXXX_cliente.pdf
✅ Drive subido (vía rclone): {pdf_drive_url}
```

---

## Fase 5 — Registro en Notion

Registrar en DB Cotizaciones (`fc5943af-5d5f-4b47-ba51-28ab56cef2f8`) vía Notion MCP:

Número COT, Cliente, Destino, Fecha, PAX adultos/menores, Excursiones incluidas, Precio final USD, Precio adulto, Precio menor, Método de pago, TC usado, `PDF Cliente` (= `pdf_drive_url` del Paso 4.2), Estado: `enviada`.

Crear subpage con desglose completo del cálculo (pasos 1–7).

> `enviada` = flujo del agente completado. No indica que el operador ya envió el PDF al cliente por WhatsApp.
> 

---

## Reglas operativas

- **Moneda excursiones:** campo `Moneda` en DB. ARS → dividir por TC. USD → usar directo.
- **Política menores:** revisar campo antes de confirmar selección. Alertar si hay restricción de edad.
- **Condiciones NITES:** mostrar campo `Condiciones` en lista (Fase 3.1) — contiene refs `(*N)` al tarifario.
- **Observaciones:** mostrar en desglose operativo. No va en PDF cliente.
- **COT-XXXX:** se asigna en Fase 1 y no cambia aunque el operador pida recálculos.

---

*cotizar-madero v1.0 — 2026-06-19*

*DB Excursiones: 384d7e4f-683b-81f7 | Config TC: 382d7e4f-683b-811d*