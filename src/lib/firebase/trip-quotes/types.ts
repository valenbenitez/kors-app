import { z } from "zod";
import type { FormulaResult } from "@/lib/cotizador/formula";
import {
  type CotizacionFormInput,
  cotizacionFormSchema,
} from "@/lib/validations/cotizacion";

export const TRIP_QUOTE_STATUSES = ["draft", "generated", "sent"] as const;
export type TripQuoteStatus = (typeof TRIP_QUOTE_STATUSES)[number];

const destinoBreakdownSchema = z.object({
  destino: z.string(),
  subtotalUsd: z.number(),
  hotelAdultoArsNet: z.number(),
  hotelMenorArsNet: z.number(),
});

export const formulaResultSchema = z.object({
  tcArsUsd: z.number(),
  subtotalUsd: z.number(),
  subtotalAdultosUsd: z.number(),
  subtotalMenoresUsd: z.number(),
  precioPaquete: z.number(),
  margenAgenciaUsd: z.number(),
  precioPostFee: z.number(),
  precioFinal: z.number(),
  margenVendedorUsd: z.number(),
  precioFinalCliente: z.number(),
  precioAdultoCliente: z.number(),
  precioMenorCliente: z.number(),
  destinos: z.array(destinoBreakdownSchema),
});

export const tripQuoteStatusSchema = z.enum(TRIP_QUOTE_STATUSES);

/** Authenticated user who generated the quote (audit). */
export const tripQuoteCreatedBySchema = z.object({
  uid: z.string().min(1),
  email: z.string().min(1),
});

export type TripQuoteCreatedBy = z.infer<typeof tripQuoteCreatedBySchema>;

/** Firestore payload before id / Date conversion. */
export const tripQuoteFirestoreSchema = z.object({
  cotNumber: z.string().min(1),
  status: tripQuoteStatusSchema,
  createdAt: z.unknown(),
  updatedAt: z.unknown(),
  createdBy: tripQuoteCreatedBySchema,
  form: cotizacionFormSchema,
  result: formulaResultSchema,
});

export type TripQuoteDoc = {
  id: string;
  cotNumber: string;
  status: TripQuoteStatus;
  createdAt: Date;
  updatedAt: Date;
  createdBy: TripQuoteCreatedBy;
  form: CotizacionFormInput;
  result: FormulaResult;
};

/** Input for create — timestamps are set by the repository. */
export type CreateTripQuoteInput = {
  cotNumber: string;
  status: TripQuoteStatus;
  form: CotizacionFormInput;
  result: FormulaResult;
  createdBy: TripQuoteCreatedBy;
};
