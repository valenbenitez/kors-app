import { provinceToCatalogDestino } from "@/lib/cotizador/provinces";

/** Hardcoded IATA codes keyed by catalog destination names. */
export const IATA_BY_DESTINO: Record<string, string> = {
  Iguazú: "IGR",
  Bariloche: "BRC",
  Calafate: "FTE",
  Ushuaia: "USH",
  "Salta-Jujuy": "SLA",
  Mendoza: "MDZ",
  "Buenos Aires": "AEP",
  Uruguay: "MVD",
};

export const ORIGIN_IATA = "AEP";

/** Resolve IATA for a form destination selection (province / Uruguay). */
export function iataForDestination(selection: string): string {
  const catalogDestino = provinceToCatalogDestino(selection);
  if (!catalogDestino) return "???";
  return IATA_BY_DESTINO[catalogDestino] ?? "???";
}

export function formatDateEs(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function nightsLabel(ida: string, vuelta: string): string {
  const a = new Date(`${ida}T12:00:00`);
  const b = new Date(`${vuelta}T12:00:00`);
  const n = Math.max(Math.round((b.getTime() - a.getTime()) / 86_400_000), 0);
  return `${n} ${n === 1 ? "noche" : "noches"}`;
}

export function paymentMethodDesc(
  method: "tarjeta" | "beetransfer" | "efectivo",
): string {
  switch (method) {
    case "tarjeta":
      return "Pago con tarjeta (VISA/Mastercard)";
    case "beetransfer":
      return "Transferencia via BeeTransfer";
    case "efectivo":
      return "Pago en efectivo";
  }
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const VALIDEZ_COTIZACION_DIAS = 7;

export const CONTACT = {
  calendly: "https://calendly.com/madero-viagens",
  whatsapp: "+54 9 11 4444-1111",
  email: "contacto@maderoviagens.com",
  brand: "Madero Viagens",
  evt: "14971",
  city: "Buenos Aires, Argentina",
} as const;

/** Multiplicador de fee mostrado en el PDF cliente (no es el desglose interno). */
export function feeMultiplierLabel(
  method: "tarjeta" | "beetransfer" | "efectivo",
): string {
  switch (method) {
    case "tarjeta":
      return "×1,10";
    case "beetransfer":
      return "×1,03";
    case "efectivo":
      return "×1,00";
  }
}

export function paymentFooterLine(
  method: "tarjeta" | "beetransfer" | "efectivo",
): string {
  switch (method) {
    case "tarjeta":
      return "Forma de pago: Tarjeta internacional de crédito · surcharge 10% incluido en el precio final";
    case "beetransfer":
      return "Forma de pago: Transferencia via BeeTransfer · fee 3% incluido en el precio final";
    case "efectivo":
      return "Forma de pago: Pago en efectivo · sin surcharge";
  }
}

export function weekdayLongEs(iso: string): string {
  const raw = new Intl.DateTimeFormat("es-AR", { weekday: "long" }).format(
    new Date(`${iso}T12:00:00`),
  );
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function formatDateShortMonth(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const day = d.getDate();
  const month = new Intl.DateTimeFormat("es-AR", { month: "short" })
    .format(d)
    .replace(".", "");
  const year = d.getFullYear();
  const monthCap = month.charAt(0).toUpperCase() + month.slice(1);
  return `${day} ${monthCap} ${year}`;
}
