"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { FormulaResult } from "@/lib/cotizador/formula";
import type { PaymentMethod } from "@/lib/cotizador/params";
import { FORMULA_PARAMS } from "@/lib/cotizador/params";

function moneyDec(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

function moneyInt(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function feeLabel(metodoPago: PaymentMethod): string {
  switch (metodoPago) {
    case "tarjeta":
      return `× ${(1 + FORMULA_PARAMS.cardFeePct).toFixed(2)} (tarjeta)`;
    case "beetransfer":
      return `× ${(1 + FORMULA_PARAMS.beetransferFeePct).toFixed(2)} (BeeTransfer)`;
    case "efectivo":
      return "sin fee (efectivo)";
  }
}

type FormulaBreakdownProps = {
  result: FormulaResult;
  metodoPago: PaymentMethod;
};

export function FormulaBreakdown({
  result,
  metodoPago,
}: FormulaBreakdownProps) {
  const [open, setOpen] = useState(false);
  const agencyPct = Math.round(FORMULA_PARAMS.agencyMarginPct * 100);
  const sellerPct = Math.round(FORMULA_PARAMS.sellerMarginPct * 100);

  return (
    <div className="rounded-2xl border border-border">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm font-medium tracking-wide uppercase">
          Breakdown (fórmula)
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={open}
          aria-controls="formula-breakdown-panel"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Ocultar breakdown" : "Ver breakdown"}
        </Button>
      </div>

      {open ? (
        <div
          id="formula-breakdown-panel"
          className="space-y-4 border-t border-border px-4 py-4 text-sm"
        >
          <section className="space-y-1">
            <p className="font-medium text-foreground">
              Paso 1 — ARS → USD (TC {result.tcArsUsd})
            </p>
            {result.destinos.map((d) => (
              <div
                key={`p1-${d.destino}`}
                className="pl-2 text-muted-foreground"
              >
                <p className="text-foreground/80">{d.destino}</p>
                <ul className="list-inside list-disc space-y-0.5">
                  <li>Vuelo ida adulto: {moneyDec(d.vueloIdaAdultoUsd)}</li>
                  <li>
                    Vuelo vuelta adulto: {moneyDec(d.vueloVueltaAdultoUsd)}
                  </li>
                  <li>Hotel adulto: {moneyDec(d.hotelAdultoUsd)}</li>
                  <li>
                    Experiencias adulto: {moneyDec(d.experienciasAdultoUsd)}
                  </li>
                  {d.vueloIdaMenorUsd > 0 ||
                  d.vueloVueltaMenorUsd > 0 ||
                  d.hotelMenorUsd > 0 ||
                  d.experienciasMenorUsd > 0 ? (
                    <>
                      <li>Vuelo ida menor: {moneyDec(d.vueloIdaMenorUsd)}</li>
                      <li>
                        Vuelo vuelta menor: {moneyDec(d.vueloVueltaMenorUsd)}
                      </li>
                      <li>Hotel menor: {moneyDec(d.hotelMenorUsd)}</li>
                      <li>
                        Experiencias menor: {moneyDec(d.experienciasMenorUsd)}
                      </li>
                    </>
                  ) : null}
                </ul>
              </div>
            ))}
          </section>

          <section className="space-y-1">
            <p className="font-medium text-foreground">
              Paso 2 — Gross-up por componente
            </p>
            {result.destinos.map((d) => (
              <div
                key={`p2-${d.destino}`}
                className="pl-2 text-muted-foreground"
              >
                <p className="text-foreground/80">{d.destino}</p>
                <ul className="list-inside list-disc space-y-0.5">
                  <li>Vuelo ida adulto adj: {moneyDec(d.vueloIdaAdultoAdj)}</li>
                  <li>
                    Vuelo vuelta adulto adj: {moneyDec(d.vueloVueltaAdultoAdj)}
                  </li>
                  <li>Hotel adulto adj: {moneyDec(d.hotelAdultoAdj)}</li>
                  <li>
                    Experiencias (sin gross-up):{" "}
                    {moneyDec(d.experienciasAdultoUsd)}
                  </li>
                  {d.vueloIdaMenorAdj > 0 ||
                  d.vueloVueltaMenorAdj > 0 ||
                  d.hotelMenorAdj > 0 ? (
                    <>
                      <li>
                        Vuelo ida menor adj: {moneyDec(d.vueloIdaMenorAdj)}
                      </li>
                      <li>
                        Vuelo vuelta menor adj:{" "}
                        {moneyDec(d.vueloVueltaMenorAdj)}
                      </li>
                      <li>Hotel menor adj: {moneyDec(d.hotelMenorAdj)}</li>
                    </>
                  ) : null}
                </ul>
              </div>
            ))}
          </section>

          <section className="space-y-0.5">
            <p className="font-medium text-foreground">Paso 3 — Subtotal USD</p>
            <p className="pl-2 text-muted-foreground">
              Adultos: {moneyDec(result.subtotalAdultosUsd)} · Menores:{" "}
              {moneyDec(result.subtotalMenoresUsd)} · Total:{" "}
              <span className="text-foreground">
                {moneyDec(result.subtotalUsd)}
              </span>
            </p>
          </section>

          <section className="space-y-0.5">
            <p className="font-medium text-foreground">
              Paso 4 — Margen agencia {agencyPct}%
            </p>
            <p className="pl-2 text-muted-foreground">
              Paquete: {moneyDec(result.precioPaquete)} · Margen:{" "}
              {moneyDec(result.margenAgenciaUsd)}
            </p>
          </section>

          <section className="space-y-0.5">
            <p className="font-medium text-foreground">
              Paso 5 — Fee de cobro ({feeLabel(metodoPago)})
            </p>
            <p className="pl-2 text-muted-foreground">
              Post fee: {moneyDec(result.precioPostFee)}
            </p>
          </section>

          <section className="space-y-0.5">
            <p className="font-medium text-foreground">
              Paso 6 — Precio por persona (base)
            </p>
            <p className="pl-2 text-muted-foreground">
              Adulto: {moneyDec(result.precioAdultoBase)}
              {result.precioMenorBase > 0
                ? ` · Menor: ${moneyDec(result.precioMenorBase)}`
                : ""}
            </p>
          </section>

          <section className="space-y-0.5">
            <p className="font-medium text-foreground">Paso 7 — Moneda local</p>
            <p className="pl-2 text-muted-foreground">
              N/A — MVP no convierte a moneda local del cliente.
            </p>
          </section>

          <section className="space-y-0.5">
            <p className="font-medium text-foreground">
              Paso 8 — Margen vendedor {sellerPct}%
            </p>
            <p className="pl-2 text-muted-foreground">
              Precio final: {moneyDec(result.precioFinal)} · Margen:{" "}
              {moneyDec(result.margenVendedorUsd)}
              {" · "}
              Adulto: {moneyDec(result.precioAdultoFinal)}
              {result.precioMenorFinal > 0
                ? ` · Menor: ${moneyDec(result.precioMenorFinal)}`
                : ""}
            </p>
          </section>

          <section className="space-y-0.5">
            <p className="font-medium text-foreground">
              Paso 9 — Redondeo CEILING
            </p>
            <p className="pl-2 text-muted-foreground">
              Cliente:{" "}
              <span className="text-foreground">
                {moneyInt(result.precioFinalCliente)}
              </span>
              {" · "}
              Adulto: {moneyInt(result.precioAdultoCliente)}
              {result.precioMenorCliente > 0
                ? ` · Menor: ${moneyInt(result.precioMenorCliente)}`
                : ""}
            </p>
          </section>
        </div>
      ) : null}
    </div>
  );
}
