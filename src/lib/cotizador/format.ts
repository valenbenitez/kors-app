/** Códigos IATA hardcoded (Gap 2 revisitado). */
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
} as const;
