import { describe, expect, it } from "vitest";
import {
  buildExcludesList,
  buildIncludesExcludesText,
  buildIncludesList,
  linesToText,
  textLines,
} from "@/lib/pdf/build-includes-excludes";
import {
  type CotizacionFormInput,
  emptyDestino,
} from "@/lib/validations/cotizacion";

function sampleForm(
  overrides: Partial<CotizacionFormInput> = {},
): CotizacionFormInput {
  return {
    clienteNombre: "Ana Pérez",
    paisOrigen: "Argentina",
    whatsapp: "+5491112345678",
    perfil: "Pareja",
    destinosSeleccionados: ["Río Negro"],
    fechaIda: "2027-03-10",
    fechaVuelta: "2027-03-15",
    paxAdultos: 2,
    paxMenores: 0,
    edadesMenores: [],
    metodoPago: "efectivo",
    equipaje: "carry-on",
    clienteAportaVuelos: false,
    aerolinea: "Aerolíneas Argentinas",
    vueloIdaFecha: "",
    vueloIdaHoraSalida: "",
    vueloIdaHoraLlegada: "",
    vueloIdaNumero: "",
    vueloIdaAeropuertoSalida: "",
    vueloIdaAeropuertoLlegada: "",
    vueloVueltaFecha: "",
    vueloVueltaHoraSalida: "",
    vueloVueltaHoraLlegada: "",
    vueloVueltaNumero: "",
    vueloVueltaAeropuertoSalida: "",
    vueloVueltaAeropuertoLlegada: "",
    itinerario: "",
    incluyeTexto: "",
    excluyeTexto: "",
    heroTags: [],
    paquetePremium: false,
    destinos: [
      {
        ...emptyDestino("Río Negro"),
        vueloIdaAdultoArs: 180_000,
        vueloVueltaAdultoArs: 180_000,
        hotelNoches: 4,
        hotelAdultoNocheArs: 95_000,
        hotelNombre: "Hotel Nahuel Huapi",
        hotelCategoria: "4★",
        hotelRegimen: "desayuno incluido",
        hotelIncluye: "WiFi\nPileta",
        hotelExcluye: "Spa no incluido",
        excursionIds: [],
      },
    ],
    ...overrides,
  };
}

describe("buildIncludesList / buildExcludesList", () => {
  it("includes flights, hotel lines, hotelIncluye, and asistencia", () => {
    const items = buildIncludesList(sampleForm());
    expect(items.some((i) => i.includes("vuelos"))).toBe(true);
    expect(items.some((i) => i.includes("Hotel Nahuel Huapi"))).toBe(true);
    expect(items).toContain("WiFi");
    expect(items).toContain("Pileta");
    expect(items).toContain("Asistencia al viajero básica");
  });

  it("merges destination copy excludes with hotelExcluye", () => {
    const items = buildExcludesList(sampleForm());
    expect(items).toContain("Spa no incluido");
    expect(items.length).toBeGreaterThan(1);
  });

  it("buildIncludesExcludesText joins with newlines", () => {
    const { incluyeTexto, excluyeTexto } = buildIncludesExcludesText(
      sampleForm(),
    );
    expect(incluyeTexto).toContain("\n");
    expect(incluyeTexto).toContain("WiFi");
    expect(excluyeTexto).toContain("Spa no incluido");
    expect(textLines(incluyeTexto)).toEqual(buildIncludesList(sampleForm()));
    expect(linesToText(["a", "b"])).toBe("a\nb");
  });
});
