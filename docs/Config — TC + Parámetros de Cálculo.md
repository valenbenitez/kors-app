# Config — TC + Parámetros de Cálculo

## TC del Día

Actualizar **antes de empezar a cotizar cada día**. El skill `/cotizar` lee el TC de ARS/USD desde acá.

| Moneda | Par | Tipo de Cambio | Actualizado |
| --- | --- | --- | --- |
| Peso argentino → Dólar | ARS/USD | 1420 |  2026-06-22 |
| Dólar → Sol peruano | USD/PEN | — | — |
| Dólar → Peso colombiano | USD/COP | — | — |
| Dólar → Real brasileño | USD/BRL | — | — |
| Dólar → Peso chileno | USD/CLP | — | — |
| Dólar → Guaraní | USD/PYG | — | — |
| Dólar → Peso uruguayo | USD/UYU | — | — |

> 💡 Fuente sugerida: [dolarito.ar](http://dolarito.ar) para ARS/USD — Wise o Google Finance para el resto.
> 

---

## Parámetros de Fórmula

Esta tabla es **single source of truth** de los parámetros de fórmula. El [SKILL.md](http://SKILL.md) `/cotizar-madero` Fase 2 lee estos valores en runtime junto con el TC del día — no hay duplicación en código. **Cambios aquí impactan inmediatamente en el próximo cálculo del agente sin tocar [SKILL.md](http://SKILL.md).**

| Parámetro | Variable | Valor actual | Operación en fórmula | Descripción |
| --- | --- | --- | --- | --- |
| Impuesto vuelos | `flight_tax_pct` | **5%** | costo ÷ 0,95 | Gross-up sobre costo ARS→USD de vuelos |
| Impuesto hotel | `hotel_tax_pct` | **3%** | costo ÷ 0,97 | Gross-up sobre costo ARS→USD de hotel |
| Margen agencia | `agency_margin_pct` | **30%** | subtotal ÷ 0,70 | Margen agencia puro (sin vendedor — va separado al Paso 8) |
| Fee tarjeta | `card_fee_pct` | **10%** | precio × 1,10 | Surcharge tarjeta (multiplicación desde v2.8) |
| Fee BeeTransfer | `beetransfer_fee_pct` | **3%** | precio × 1,03 | Surcharge BeeTransfer (multiplicación desde v2.8) |
| Fee efectivo | `cash_fee_pct` | **0%** | × 1,0 (sin ajuste) | Sin costo adicional |
| Margen vendedor | `seller_margin_pct` | **5%** | precio_post_fee ÷ 0,95 | Comisión vendedor (paso final separado v2.8) — registrado en columna `Margen Vendedor USD` de DB Cotizaciones para cierres admin |

---

## Fórmula Completa (8 Pasos — v2.8)

> **Cambios v2.8 (2026-06-24):** margen agencia 35→30%, fees ÷ → × (multiplicación), nuevo Paso 8 margen vendedor 5% separado para tracking de comisiones en cierres admin.
> 

**Paso 1 — ARS → USD**

Dividir cada componente por el TC del día.

```jsx
vuelo_usd = costo_vuelo_ars ÷ TC
hotel_usd = costo_hotel_ars ÷ TC
experiencias_usd = costo_exp_ars ÷ TC   (si Moneda=USD en DB, usar directo)
```

**Paso 2 — Gross-up por componente**

```
vuelo_adj  = vuelo_usd ÷ 0,95   (+5% impuesto vuelos)
hotel_adj  = hotel_usd ÷ 0,97   (+3% impuesto hotel)
exp_adj    = experiencias_usd    (sin ajuste)
```

**Paso 3 — Subtotal USD por tipo PAX**

```
subtotal_adulto = (vuelo_ida_adj + vuelo_vuelta_adj + hotel_adj) × n_adultos
subtotal_nino   = (vuelo_ida_adj + vuelo_vuelta_adj + hotel_adj) × n_ninos
exp_por_pax     = exp_adj ÷ total_pax  (se distribuye igual entre todos)
subtotal_usd    = subtotal_adulto + subtotal_nino + exp_adj
```

**Paso 4 — Margen agencia 30%** (sin vendedor)

```jsx
precio_paquete = subtotal_usd ÷ 0,70
margen_agencia_usd = precio_paquete − subtotal_usd   (→ Notion campo Margen USD)
```

**Paso 5 — Fee de cobro (MULTIPLICACIÓN v2.8)**

```jsx
tarjeta:      precio_post_fee = precio_paquete × 1,10
beetransfer:  precio_post_fee = precio_paquete × 1,03
efectivo:     precio_post_fee = precio_paquete
```

**Paso 6 — Precio por PAX (base, antes de vendedor)**

```jsx
precio_adulto_base = precio_post_fee × (subtotal_adulto / subtotal_usd) ÷ n_adultos
precio_nino_base   = precio_post_fee × (subtotal_nino   / subtotal_usd) ÷ n_ninos
                     (si pax_menores = 0: precio_nino_base = 0)
```

**Paso 7 — Moneda local del cliente (opcional)**

```jsx
Si el operador provee TC_USD_LOCAL:
precio_local = precio_final_cliente × TC_USD_LOCAL
                (usar el valor del Paso 9 con CEILING)
```

**Paso 8 — Margen vendedor 5% AL FINAL** (NUEVO v2.8)

Se agrega como paso final separado para auditoría contable y cierres admin de comisiones. La fila `Margen Vendedor USD` queda explicitada en la DB Cotizaciones.

```jsx
precio_final = precio_post_fee ÷ 0,95
margen_vendedor_usd = precio_final × 0,05   (= precio_final − precio_post_fee)
                                              (→ Notion campo Margen Vendedor USD)

precio_adulto_final = precio_adulto_base ÷ 0,95
precio_nino_final   = precio_nino_base   ÷ 0,95
```

**Paso 9 — Redondeo CEILING_v1 cliente-facing** (v2.7+ se mantiene)

```jsx
precio_final_cliente  = ⌈precio_final⌉            (entero — → Notion Precio Final USD + PDF)
precio_adulto_cliente = ⌈precio_adulto_final⌉     (entero — → Notion Precio/Adulto + PDF)
precio_nino_cliente   = ⌈precio_nino_final⌉       (entero — → Notion Precio/Niño + PDF)
```

Internos (`Costo Neto USD`, `Margen USD`, `Margen Vendedor USD`) mantienen HALF_UP a 2 decimales para audit contable.

> ⚠️ Todos los cálculos usan `decimal.Decimal`. Cliente-facing con `ROUND_CEILING` a entero (Paso 9). Internos con `ROUND_HALF_UP` a 2 decimales. No usar float directo.
> 

---

## Historial de Cambios

| Fecha | Parámetro | Valor anterior | Valor nuevo | Motivo |
| --- | --- | --- | --- | --- |
| 2026-06-17 | Todos | — | Ver tabla arriba | Versión inicial |
| 2026-06-24 | `agency_margin_pct` | 35% (÷ 0,65) | 30% (÷ 0,70) | v2.8 — desglose vendedor a Paso 8 separado |
| 2026-06-24 | `card_fee_pct` | 10% (÷ 0,90) | 10% (× 1,10) | v2.8 — cambio a multiplicación (pedido founder) |
| 2026-06-24 | `beetransfer_fee_pct` | 3% (÷ 0,97) | 3% (× 1,03) | v2.8 — cambio a multiplicación (pedido founder) |
| 2026-06-24 | `seller_margin_pct` (NUEVO) | — (implícito en agencia 35%) | 5% (÷ 0,95) Paso 8 | v2.8 — nueva fila + columna DB Cotizaciones `Margen Vendedor USD` para cierres admin |