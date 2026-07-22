import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { TRIP_QUOTES } from "@/lib/firebase/collections";
import {
  mapFirebaseError,
  TripQuoteNotFoundError,
  TripQuoteValidationError,
} from "@/lib/firebase/errors";
import {
  type CreateTripQuoteInput,
  type TripQuoteDoc,
  tripQuoteFirestoreSchema,
} from "@/lib/firebase/trip-quotes/types";

function toDate(value: unknown): Date {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (value instanceof Date) {
    return value;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  throw new TripQuoteValidationError(
    "Invalid date field in trip quote document",
  );
}

/** Typed parse of a raw Firestore document into TripQuoteDoc. */
export function parseTripQuoteDoc(
  id: string,
  data: Record<string, unknown>,
): TripQuoteDoc {
  const parsed = tripQuoteFirestoreSchema.safeParse(data);
  if (!parsed.success) {
    throw new TripQuoteValidationError(
      `Invalid trip quote document (${id}): ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
      { cause: parsed.error },
    );
  }

  const d = parsed.data;
  return {
    id,
    cotNumber: d.cotNumber,
    status: d.status,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
    createdBy: d.createdBy,
    form: d.form,
    result: d.result,
    pdfClienteUrl: d.pdfClienteUrl,
    pdfStoragePath: d.pdfStoragePath,
    driveFileId: d.driveFileId,
    roundingRule: d.roundingRule,
    costoNetoUsd: d.costoNetoUsd,
    margenAgenciaUsd: d.margenAgenciaUsd,
    margenVendedorUsd: d.margenVendedorUsd,
    precioFinalCliente: d.precioFinalCliente,
    perfil: d.perfil,
    premiumTag: d.premiumTag,
    clienteNombre: d.clienteNombre,
  };
}

/**
 * Persists a new trip quote. Returns the Firestore document id.
 * Cot numbers are allocated separately via `allocateCotNumber`.
 */
export async function createTripQuote(
  input: CreateTripQuoteInput,
): Promise<string> {
  try {
    const ref = getAdminFirestore().collection(TRIP_QUOTES).doc();
    const now = FieldValue.serverTimestamp();

    await ref.set({
      cotNumber: input.cotNumber,
      status: input.status,
      createdAt: now,
      updatedAt: now,
      createdBy: input.createdBy,
      form: input.form,
      result: input.result,
      pdfClienteUrl: input.pdfClienteUrl ?? null,
      pdfStoragePath: input.pdfStoragePath ?? null,
      driveFileId: input.driveFileId ?? null,
      roundingRule: input.roundingRule ?? "CEILING_v1",
      costoNetoUsd: input.costoNetoUsd ?? input.result.subtotalUsd,
      margenAgenciaUsd: input.margenAgenciaUsd ?? input.result.margenAgenciaUsd,
      margenVendedorUsd:
        input.margenVendedorUsd ?? input.result.margenVendedorUsd,
      precioFinalCliente:
        input.precioFinalCliente ?? input.result.precioFinalCliente,
      perfil: input.perfil ?? input.form.perfil,
      premiumTag: input.premiumTag ?? false,
      clienteNombre: input.clienteNombre ?? input.form.clienteNombre,
    });

    return ref.id;
  } catch (error) {
    mapFirebaseError(error, "createTripQuote");
  }
}

/** Patches Drive PDF fields after a successful upload. */
export async function updateTripQuoteDriveFields(
  id: string,
  fields: {
    pdfClienteUrl: string | null;
    pdfStoragePath: string | null;
    driveFileId: string | null;
  },
): Promise<void> {
  try {
    const ref = getAdminFirestore().collection(TRIP_QUOTES).doc(id);
    await ref.update({
      pdfClienteUrl: fields.pdfClienteUrl,
      pdfStoragePath: fields.pdfStoragePath,
      driveFileId: fields.driveFileId,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    mapFirebaseError(error, "updateTripQuoteDriveFields");
  }
}

/** Loads a trip quote by Firestore document id. */
export async function getTripQuoteById(id: string): Promise<TripQuoteDoc> {
  try {
    const snap = await getAdminFirestore()
      .collection(TRIP_QUOTES)
      .doc(id)
      .get();
    if (!snap.exists) {
      throw new TripQuoteNotFoundError(id);
    }
    const data = snap.data();
    if (!data) {
      throw new TripQuoteNotFoundError(id);
    }
    return parseTripQuoteDoc(snap.id, data as Record<string, unknown>);
  } catch (error) {
    mapFirebaseError(error, "getTripQuoteById");
  }
}

/** Loads a trip quote by cot number (e.g. COT-0010). */
export async function getTripQuoteByCotNumber(
  cotNumber: string,
): Promise<TripQuoteDoc> {
  try {
    const snap = await getAdminFirestore()
      .collection(TRIP_QUOTES)
      .where("cotNumber", "==", cotNumber)
      .limit(1)
      .get();

    if (snap.empty) {
      throw new TripQuoteNotFoundError(cotNumber);
    }

    const doc = snap.docs[0];
    if (!doc) {
      throw new TripQuoteNotFoundError(cotNumber);
    }

    return parseTripQuoteDoc(doc.id, doc.data() as Record<string, unknown>);
  } catch (error) {
    mapFirebaseError(error, "getTripQuoteByCotNumber");
  }
}

function sortByCreatedAtDesc(docs: TripQuoteDoc[]): TripQuoteDoc[] {
  return docs.toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Lists trip quotes created by a given user uid (newest first).
 * Sorted in memory to avoid a composite Firestore index on createdBy.uid + createdAt.
 */
export async function listTripQuotesForUser(
  uid: string,
  options: { limit?: number } = {},
): Promise<TripQuoteDoc[]> {
  const limit = options.limit ?? 50;
  try {
    const snap = await getAdminFirestore()
      .collection(TRIP_QUOTES)
      .where("createdBy.uid", "==", uid)
      .get();

    const docs = snap.docs.map((doc) =>
      parseTripQuoteDoc(doc.id, doc.data() as Record<string, unknown>),
    );
    return sortByCreatedAtDesc(docs).slice(0, limit);
  } catch (error) {
    mapFirebaseError(error, "listTripQuotesForUser");
  }
}

/**
 * Lists all trip quotes (admin). Newest first via Firestore orderBy.
 */
export async function listTripQuotesAll(
  options: { limit?: number } = {},
): Promise<TripQuoteDoc[]> {
  const limit = options.limit ?? 50;
  try {
    const snap = await getAdminFirestore()
      .collection(TRIP_QUOTES)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    return snap.docs.map((doc) =>
      parseTripQuoteDoc(doc.id, doc.data() as Record<string, unknown>),
    );
  } catch (error) {
    mapFirebaseError(error, "listTripQuotesAll");
  }
}
