import Decimal from "decimal.js";
import {
  FORMULA_PARAMS,
  type FormulaParams,
  feeMultiplier,
  type PaymentMethod,
} from "@/lib/cotizador/params";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type PoliticaMenores =
  | "Mismo adulto"
  | "Precio especial"
  | "No aplica"
  | "Consultar";

export type ExcursionInput = {
  id: string;
  nombre: string;
  neto: number;
  moneda: "ARS" | "USD";
  precioMenor: number | null;
  politicaMenores: PoliticaMenores;
};

export type DestinoCostInput = {
  destino: string;
  vueloIdaAdultoArs: number;
  vueloIdaMenorArs: number;
  vueloVueltaAdultoArs: number;
  vueloVueltaMenorArs: number;
  /** Stay nights (int, no FX). Cost = nights × per-night rate. nights 0 → 0 cost. */
  hotelNoches: number;
  /** Per-adult price per night in ARS-equivalent. */
  hotelAdultoNocheArs: number;
  /** Per-minor price per night in ARS-equivalent. */
  hotelMenorNocheArs: number;
  /** Ajuste operador ARS (±). Default: se aplica solo al adulto (Gap 5). */
  hotelAjusteArs?: number;
  hotelNombre?: string;
  hotelCategoria?: string;
  hotelRegimen?: string;
  hotelUbicacion?: string;
  hotelHabitacion?: string;
  hotelAjusteRazon?: string;
  excursiones: ExcursionInput[];
};

export type CotizacionInput = {
  paxAdultos: number;
  paxMenores: number;
  metodoPago: PaymentMethod;
  destinos: DestinoCostInput[];
  tcArsUsd?: number;
};

/** Per-destino intermediates for formula steps 1–2 (UI breakdown; HALF_UP 2dp). */
export type DestinoBreakdown = {
  destino: string;
  subtotalUsd: number;
  hotelAdultoArsNet: number;
  hotelMenorArsNet: number;
  /** Paso 1 — ARS→USD unit amounts (before gross-up, before × pax). */
  vueloIdaAdultoUsd: number;
  vueloIdaMenorUsd: number;
  vueloVueltaAdultoUsd: number;
  vueloVueltaMenorUsd: number;
  hotelAdultoUsd: number;
  hotelMenorUsd: number;
  /** Sum of excursion netos in USD for one adult (before × pax). */
  experienciasAdultoUsd: number;
  /** Sum of excursion netos in USD for one minor (before × pax). */
  experienciasMenorUsd: number;
  /** Paso 2 — gross-up unit amounts (excursions unchanged). */
  vueloIdaAdultoAdj: number;
  vueloIdaMenorAdj: number;
  vueloVueltaAdultoAdj: number;
  vueloVueltaMenorAdj: number;
  hotelAdultoAdj: number;
  hotelMenorAdj: number;
};

export type FormulaResult = {
  tcArsUsd: number;
  subtotalUsd: number;
  subtotalAdultosUsd: number;
  subtotalMenoresUsd: number;
  precioPaquete: number;
  margenAgenciaUsd: number;
  precioPostFee: number;
  /** Paso 6 — per-pax base on post-fee, before seller margin (HALF_UP 2dp). */
  precioAdultoBase: number;
  precioMenorBase: number;
  precioFinal: number;
  margenVendedorUsd: number;
  /** Paso 8 — per-pax after seller, before CEILING (HALF_UP 2dp). */
  precioAdultoFinal: number;
  precioMenorFinal: number;
  precioFinalCliente: number;
  precioAdultoCliente: number;
  precioMenorCliente: number;
  destinos: DestinoBreakdown[];
};

export class FormulaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormulaError";
  }
}

function halfUp2(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

function ceilingInt(value: Decimal): number {
  return value.toDecimalPlaces(0, Decimal.ROUND_CEIL).toNumber();
}

function toUsd(amount: number, moneda: "ARS" | "USD", tc: Decimal): Decimal {
  if (moneda === "USD") {
    return new Decimal(amount);
  }
  return new Decimal(amount).div(tc);
}

function calcularNetoExcursion(
  exc: ExcursionInput,
  tc: Decimal,
  paxMenores: number,
): { netoAdultoUsd: Decimal; netoMenorUsd: Decimal } {
  const netoAdultoUsd = toUsd(exc.neto, exc.moneda, tc);

  switch (exc.politicaMenores) {
    case "Mismo adulto":
      return { netoAdultoUsd, netoMenorUsd: netoAdultoUsd };
    case "Precio especial": {
      if (exc.precioMenor === null) {
        if (paxMenores === 0) {
          return { netoAdultoUsd, netoMenorUsd: new Decimal(0) };
        }
        throw new FormulaError(
          `Excursion "${exc.nombre}" has "Precio especial" but no minor price loaded`,
        );
      }
      return {
        netoAdultoUsd,
        netoMenorUsd: toUsd(exc.precioMenor, exc.moneda, tc),
      };
    }
    case "No aplica":
      return { netoAdultoUsd, netoMenorUsd: new Decimal(0) };
    case "Consultar":
      if (paxMenores > 0) {
        throw new FormulaError(
          `STOP: Excursión "${exc.nombre}" con política "Consultar" y hay menores. Consultar precio con proveedor.`,
        );
      }
      return { netoAdultoUsd, netoMenorUsd: new Decimal(0) };
  }
}

function hotelAdultoConAjuste(
  stayAdultoArs: Decimal,
  hotelAjusteArs: number,
  params: FormulaParams,
): Decimal {
  if (params.hotelAdjustmentAppliesTo === "adulto") {
    return stayAdultoArs.plus(hotelAjusteArs);
  }
  return stayAdultoArs;
}

/**
 * Cotizador formula **v2.8** (30% agency, × payment fees, 5% seller, CEILING).
 *
 * Minors excursion policy (`PoliticaMenores` + `precioMenor`) is the documented
 * **v2.9 patch** on top of v2.8 — product UI still labels the base as v2.8.
 *
 * Internals: HALF_UP 2 dp. Client-facing: CEILING to integer.
 * Optional `params` override (tests / future API); defaults to `FORMULA_PARAMS`.
 */
export function calcularCotizacion(
  input: CotizacionInput,
  params: FormulaParams = FORMULA_PARAMS,
): FormulaResult {
  const { paxAdultos, paxMenores, metodoPago, destinos } = input;

  if (paxAdultos < 1) {
    throw new FormulaError("Debe haber al menos 1 adulto");
  }
  if (paxMenores < 0) {
    throw new FormulaError("Menores no puede ser negativo");
  }
  if (destinos.length < 1) {
    throw new FormulaError("Debe haber al menos 1 destino");
  }

  const tc = new Decimal(input.tcArsUsd ?? params.tcArsUsd);
  const flightDivisor = new Decimal(1).minus(params.flightTaxPct);
  const hotelDivisor = new Decimal(1).minus(params.hotelTaxPct);
  const agencyDivisor = new Decimal(1).minus(params.agencyMarginPct);
  const sellerDivisor = new Decimal(1).minus(params.sellerMarginPct);

  let subtotalAdultos = new Decimal(0);
  let subtotalMenores = new Decimal(0);
  const destinoBreakdowns: DestinoBreakdown[] = [];

  for (const dest of destinos) {
    const noches = new Decimal(dest.hotelNoches);
    const stayAdulto = noches.times(dest.hotelAdultoNocheArs);
    const stayMenor = noches.times(dest.hotelMenorNocheArs);
    const hotelAjuste = dest.hotelAjusteArs ?? 0;
    const hotelAdultoArsNet = hotelAdultoConAjuste(
      stayAdulto,
      hotelAjuste,
      params,
    );
    const hotelMenorArsNet = stayMenor;

    const vueloIdaAdultoUsd = toUsd(dest.vueloIdaAdultoArs, "ARS", tc);
    const vueloVueltaAdultoUsd = toUsd(dest.vueloVueltaAdultoArs, "ARS", tc);
    const vueloIdaMenorUsd = toUsd(dest.vueloIdaMenorArs, "ARS", tc);
    const vueloVueltaMenorUsd = toUsd(dest.vueloVueltaMenorArs, "ARS", tc);
    const hotelAdultoUsd = hotelAdultoArsNet.div(tc);
    const hotelMenorUsd = hotelMenorArsNet.div(tc);

    const vueloIdaAdultoAdj = vueloIdaAdultoUsd.div(flightDivisor);
    const vueloVueltaAdultoAdj = vueloVueltaAdultoUsd.div(flightDivisor);
    const vueloIdaMenorAdj = vueloIdaMenorUsd.div(flightDivisor);
    const vueloVueltaMenorAdj = vueloVueltaMenorUsd.div(flightDivisor);

    const hotelAdultoAdj = hotelAdultoUsd.div(hotelDivisor);
    const hotelMenorAdj = hotelMenorUsd.div(hotelDivisor);

    const baseAdulto = vueloIdaAdultoAdj
      .plus(vueloVueltaAdultoAdj)
      .plus(hotelAdultoAdj);
    const baseMenor = vueloIdaMenorAdj
      .plus(vueloVueltaMenorAdj)
      .plus(hotelMenorAdj);

    let expAdultoUnit = new Decimal(0);
    let expMenorUnit = new Decimal(0);
    let expAdultos = new Decimal(0);
    let expMenores = new Decimal(0);

    for (const exc of dest.excursiones) {
      const { netoAdultoUsd, netoMenorUsd } = calcularNetoExcursion(
        exc,
        tc,
        paxMenores,
      );
      expAdultoUnit = expAdultoUnit.plus(netoAdultoUsd);
      expMenorUnit = expMenorUnit.plus(netoMenorUsd);
      expAdultos = expAdultos.plus(netoAdultoUsd.times(paxAdultos));
      expMenores = expMenores.plus(netoMenorUsd.times(paxMenores));
    }

    const destAdultos = baseAdulto.times(paxAdultos).plus(expAdultos);
    const destMenores =
      paxMenores > 0
        ? baseMenor.times(paxMenores).plus(expMenores)
        : new Decimal(0);
    const destSubtotal = destAdultos.plus(destMenores);

    subtotalAdultos = subtotalAdultos.plus(destAdultos);
    subtotalMenores = subtotalMenores.plus(destMenores);

    destinoBreakdowns.push({
      destino: dest.destino,
      subtotalUsd: halfUp2(destSubtotal).toNumber(),
      hotelAdultoArsNet: hotelAdultoArsNet.toNumber(),
      hotelMenorArsNet: hotelMenorArsNet.toNumber(),
      vueloIdaAdultoUsd: halfUp2(vueloIdaAdultoUsd).toNumber(),
      vueloIdaMenorUsd: halfUp2(vueloIdaMenorUsd).toNumber(),
      vueloVueltaAdultoUsd: halfUp2(vueloVueltaAdultoUsd).toNumber(),
      vueloVueltaMenorUsd: halfUp2(vueloVueltaMenorUsd).toNumber(),
      hotelAdultoUsd: halfUp2(hotelAdultoUsd).toNumber(),
      hotelMenorUsd: halfUp2(hotelMenorUsd).toNumber(),
      experienciasAdultoUsd: halfUp2(expAdultoUnit).toNumber(),
      experienciasMenorUsd:
        paxMenores > 0 ? halfUp2(expMenorUnit).toNumber() : 0,
      vueloIdaAdultoAdj: halfUp2(vueloIdaAdultoAdj).toNumber(),
      vueloIdaMenorAdj: halfUp2(vueloIdaMenorAdj).toNumber(),
      vueloVueltaAdultoAdj: halfUp2(vueloVueltaAdultoAdj).toNumber(),
      vueloVueltaMenorAdj: halfUp2(vueloVueltaMenorAdj).toNumber(),
      hotelAdultoAdj: halfUp2(hotelAdultoAdj).toNumber(),
      hotelMenorAdj: halfUp2(hotelMenorAdj).toNumber(),
    });
  }

  const subtotalUsd = halfUp2(subtotalAdultos.plus(subtotalMenores));
  const subtotalAdultosUsd = halfUp2(subtotalAdultos);
  const subtotalMenoresUsd = halfUp2(subtotalMenores);

  const precioPaquete = halfUp2(subtotalUsd.div(agencyDivisor));
  const margenAgenciaUsd = halfUp2(precioPaquete.minus(subtotalUsd));

  const precioPostFee = halfUp2(
    precioPaquete.times(feeMultiplier(metodoPago, params)),
  );

  const precioFinal = halfUp2(precioPostFee.div(sellerDivisor));
  const margenVendedorUsd = halfUp2(precioFinal.minus(precioPostFee));

  const precioFinalCliente = ceilingInt(precioFinal);

  let precioAdultoBase = 0;
  let precioMenorBase = 0;
  let precioAdultoFinal = 0;
  let precioMenorFinal = 0;
  let precioAdultoCliente = 0;
  let precioMenorCliente = 0;

  if (subtotalUsd.gt(0)) {
    const ratioAdulto = subtotalAdultosUsd.div(subtotalUsd);
    const adultoBase = precioPostFee.times(ratioAdulto).div(paxAdultos);
    const adultoFinal = adultoBase.div(sellerDivisor);
    precioAdultoBase = halfUp2(adultoBase).toNumber();
    precioAdultoFinal = halfUp2(adultoFinal).toNumber();
    precioAdultoCliente = ceilingInt(adultoFinal);

    if (paxMenores > 0) {
      const ratioMenor = subtotalMenoresUsd.div(subtotalUsd);
      const menorBase = precioPostFee.times(ratioMenor).div(paxMenores);
      const menorFinal = menorBase.div(sellerDivisor);
      precioMenorBase = halfUp2(menorBase).toNumber();
      precioMenorFinal = halfUp2(menorFinal).toNumber();
      precioMenorCliente = ceilingInt(menorFinal);
    }
  }

  return {
    tcArsUsd: tc.toNumber(),
    subtotalUsd: subtotalUsd.toNumber(),
    subtotalAdultosUsd: subtotalAdultosUsd.toNumber(),
    subtotalMenoresUsd: subtotalMenoresUsd.toNumber(),
    precioPaquete: precioPaquete.toNumber(),
    margenAgenciaUsd: margenAgenciaUsd.toNumber(),
    precioPostFee: precioPostFee.toNumber(),
    precioAdultoBase,
    precioMenorBase,
    precioFinal: precioFinal.toNumber(),
    margenVendedorUsd: margenVendedorUsd.toNumber(),
    precioAdultoFinal,
    precioMenorFinal,
    precioFinalCliente,
    precioAdultoCliente,
    precioMenorCliente,
    destinos: destinoBreakdowns,
  };
}
