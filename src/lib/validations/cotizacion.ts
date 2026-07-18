import { z } from "zod";
import { DESTINOS } from "@/lib/cotizador/catalog";

export const PAISES = [
  "Argentina",
  "Colombia",
  "Chile",
  "Brasil",
  "Perú",
  "Uruguay",
  "Paraguay",
  "USA",
  "España",
  "Otro",
] as const;

export const PERFILES = [
  "Pareja",
  "Familia con niños",
  "Grupo adultos",
  "Aventura",
  "Lujo",
  "Primer viaje",
  "Otro",
] as const;

export const METODOS_PAGO = ["tarjeta", "beetransfer", "efectivo"] as const;

export const EQUIPAJES = [
  "carry-on",
  "valija 15 kg",
  "valija 23 kg",
  "2 valijas",
  "no incluye",
] as const;

export const HOTEL_CATEGORIAS = ["3★", "4★", "5★"] as const;

export const MONEDAS = ["CLP", "ARS", "COP", "PIX", "USD", "PEN"] as const;

export type FormMoneda = (typeof MONEDAS)[number];

const destinoFormSchema = z.object({
  destino: z.enum(DESTINOS),
  moneda: z.enum(MONEDAS),
  vueloIdaAdultoArs: z.coerce.number().min(0),
  vueloIdaMenorArs: z.coerce.number().min(0),
  vueloVueltaAdultoArs: z.coerce.number().min(0),
  vueloVueltaMenorArs: z.coerce.number().min(0),
  hotelAdultoArs: z.coerce.number().min(0),
  hotelMenorArs: z.coerce.number().min(0),
  hotelNombre: z.string(),
  hotelCategoria: z.union([z.enum(HOTEL_CATEGORIAS), z.literal("")]),
  hotelRegimen: z.string(),
  hotelUbicacion: z.string(),
  hotelHabitacion: z.string(),
  hotelAjusteArs: z.coerce.number(),
  hotelAjusteRazon: z.string(),
  excursionIds: z.array(z.string()),
});

export const cotizacionFormSchema = z
  .object({
    clienteNombre: z.string().min(2, "Ingresá el nombre del cliente"),
    paisOrigen: z.enum(PAISES),
    whatsapp: z.string().min(8, "Ingresá un WhatsApp válido"),
    perfil: z.enum(PERFILES),
    destinosSeleccionados: z
      .array(z.enum(DESTINOS))
      .min(1, "Seleccioná al menos un destino"),
    fechaIda: z.string().min(1, "Fecha de ida requerida"),
    fechaVuelta: z.string().min(1, "Fecha de vuelta requerida"),
    paxAdultos: z.coerce.number().int().min(1, "Mínimo 1 adulto"),
    paxMenores: z.coerce.number().int().min(0),
    edadesMenores: z.array(z.coerce.number().int().min(0).max(17)),
    metodoPago: z.enum(METODOS_PAGO),
    equipaje: z.enum(EQUIPAJES),
    aerolinea: z.string(),
    itinerario: z.string(),
    destinos: z.array(destinoFormSchema).min(1),
  })
  .superRefine((data, ctx) => {
    if (data.fechaVuelta < data.fechaIda) {
      ctx.addIssue({
        code: "custom",
        message: "La fecha de vuelta debe ser posterior a la ida",
        path: ["fechaVuelta"],
      });
    }
    if (data.paxMenores > 0 && data.edadesMenores.length !== data.paxMenores) {
      ctx.addIssue({
        code: "custom",
        message: "Ingresá la edad de cada menor",
        path: ["edadesMenores"],
      });
    }
    if (data.destinos.length !== data.destinosSeleccionados.length) {
      ctx.addIssue({
        code: "custom",
        message: "Completá los costos de cada destino",
        path: ["destinos"],
      });
    }
  });

export type CotizacionFormInput = z.infer<typeof cotizacionFormSchema>;
export type DestinoFormInput = z.infer<typeof destinoFormSchema>;

export function emptyDestino(
  destino: (typeof DESTINOS)[number],
): DestinoFormInput {
  return {
    destino,
    moneda: "ARS",
    vueloIdaAdultoArs: 0,
    vueloIdaMenorArs: 0,
    vueloVueltaAdultoArs: 0,
    vueloVueltaMenorArs: 0,
    hotelAdultoArs: 0,
    hotelMenorArs: 0,
    hotelNombre: "",
    hotelCategoria: "",
    hotelRegimen: "",
    hotelUbicacion: "",
    hotelHabitacion: "",
    hotelAjusteArs: 0,
    hotelAjusteRazon: "",
    excursionIds: [],
  };
}

export const defaultCotizacionValues: CotizacionFormInput = {
  clienteNombre: "",
  paisOrigen: "Argentina",
  whatsapp: "",
  perfil: "Primer viaje",
  destinosSeleccionados: ["Iguazú"],
  fechaIda: "",
  fechaVuelta: "",
  paxAdultos: 1,
  paxMenores: 0,
  edadesMenores: [],
  metodoPago: "tarjeta",
  equipaje: "carry-on",
  aerolinea: "",
  itinerario: "",
  destinos: [emptyDestino("Iguazú")],
};
