import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, test } from "vitest";
import { normalizeFirebasePrivateKey } from "@/lib/env";
import {
  FirebaseConfigError,
  FirebaseDomainError,
  mapFirebaseError,
  TripQuoteNotFoundError,
  TripQuoteValidationError,
} from "@/lib/firebase/errors";
import { parseTripQuoteDoc } from "@/lib/firebase/trip-quotes/repository";

describe("firebase domain errors", () => {
  test("mapFirebaseError rethrows FirebaseDomainError subclasses", () => {
    const notFound = new TripQuoteNotFoundError("abc");
    expect(() => mapFirebaseError(notFound)).toThrow(TripQuoteNotFoundError);
    expect(() => mapFirebaseError(notFound)).toThrow(/abc/);
  });

  test("mapFirebaseError wraps Firebase-like errors with code", () => {
    expect(() =>
      mapFirebaseError(
        {
          code: "permission-denied",
          message: "Missing or insufficient permissions.",
        },
        "createTripQuote",
      ),
    ).toThrow(FirebaseDomainError);

    try {
      mapFirebaseError(
        { code: "unavailable", message: "backend blew up" },
        "getTripQuoteById",
      );
    } catch (error) {
      expect(error).toBeInstanceOf(FirebaseDomainError);
      expect((error as FirebaseDomainError).message).toContain(
        "getTripQuoteById",
      );
      expect((error as FirebaseDomainError).message).toContain("unavailable");
      expect((error as FirebaseDomainError).name).toBe("FirebaseDomainError");
    }
  });

  test("mapFirebaseError wraps generic Error", () => {
    expect(() => mapFirebaseError(new Error("boom"), "ctx")).toThrow(
      /ctx: boom/,
    );
  });

  test("FirebaseConfigError is a FirebaseDomainError", () => {
    const err = new FirebaseConfigError("missing key");
    expect(err).toBeInstanceOf(FirebaseDomainError);
    expect(err.name).toBe("FirebaseConfigError");
  });
});

describe("normalizeFirebasePrivateKey", () => {
  test("replaces escaped newlines from .env", () => {
    const raw =
      "-----BEGIN PRIVATE KEY-----\\nLINE1\\nLINE2\\n-----END PRIVATE KEY-----\\n";
    expect(normalizeFirebasePrivateKey(raw)).toBe(
      "-----BEGIN PRIVATE KEY-----\nLINE1\nLINE2\n-----END PRIVATE KEY-----\n",
    );
  });
});

describe("parseTripQuoteDoc", () => {
  const validForm = {
    clienteNombre: "Ana",
    paisOrigen: "Argentina" as const,
    whatsapp: "+5491112345678",
    perfil: "Pareja" as const,
    destinosSeleccionados: ["Misiones" as const],
    fechaIda: "2026-07-01",
    fechaVuelta: "2026-07-05",
    paxAdultos: 2,
    paxMenores: 0,
    edadesMenores: [] as number[],
    metodoPago: "tarjeta" as const,
    equipaje: "carry-on" as const,
    clienteAportaVuelos: false,
    aerolinea: "JetSMART",
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
    itinerario: "Día 1",
    destinos: [
      {
        destino: "Misiones" as const,
        moneda: "ARS" as const,
        vueloIdaAdultoArs: 100,
        vueloIdaMenorArs: 0,
        vueloVueltaAdultoArs: 100,
        vueloVueltaMenorArs: 0,
        hotelNoches: 1,
        hotelAdultoNocheArs: 200,
        hotelMenorNocheArs: 0,
        hotelNombre: "Hotel",
        hotelCategoria: "4★" as const,
        hotelRegimen: "desayuno",
        hotelUbicacion: "centro",
        hotelHabitacion: "doble",
        hotelIncluye: "",
        hotelExcluye: "",
        hotelCondiciones: "",
        hotelAjusteArs: 0,
        hotelAjusteRazon: "",
        excursionIds: [] as string[],
      },
    ],
  };

  const validResult = {
    tcArsUsd: 1400,
    subtotalUsd: 100,
    subtotalAdultosUsd: 100,
    subtotalMenoresUsd: 0,
    precioPaquete: 110,
    margenAgenciaUsd: 10,
    precioPostFee: 120,
    precioFinal: 120,
    margenVendedorUsd: 5,
    precioFinalCliente: 125,
    precioAdultoCliente: 62.5,
    precioMenorCliente: 0,
    destinos: [
      {
        destino: "Misiones",
        subtotalUsd: 100,
        hotelAdultoArsNet: 200,
        hotelMenorArsNet: 0,
      },
    ],
  };

  test("parses a valid Firestore document with Timestamp dates", () => {
    const createdAt = Timestamp.fromDate(new Date("2026-07-01T12:00:00Z"));
    const updatedAt = Timestamp.fromDate(new Date("2026-07-01T13:00:00Z"));

    const doc = parseTripQuoteDoc("doc-1", {
      cotNumber: "COT-0010",
      status: "generated",
      createdAt,
      updatedAt,
      createdBy: { uid: "uid-1", email: "a@kors.com" },
      form: validForm,
      result: validResult,
    });

    expect(doc.id).toBe("doc-1");
    expect(doc.cotNumber).toBe("COT-0010");
    expect(doc.status).toBe("generated");
    expect(doc.createdAt).toEqual(createdAt.toDate());
    expect(doc.updatedAt).toEqual(updatedAt.toDate());
    expect(doc.createdBy).toEqual({ uid: "uid-1", email: "a@kors.com" });
    expect(doc.form.clienteNombre).toBe("Ana");
    expect(doc.result.precioFinalCliente).toBe(125);
  });

  test("throws TripQuoteValidationError on invalid payload", () => {
    expect(() =>
      parseTripQuoteDoc("bad", {
        cotNumber: "",
        status: "nope",
        createdAt: new Date(),
        updatedAt: new Date(),
        form: {},
        result: {},
      }),
    ).toThrow(TripQuoteValidationError);
  });
});
