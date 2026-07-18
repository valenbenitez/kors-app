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

  return {
    id,
    cotNumber: parsed.data.cotNumber,
    status: parsed.data.status,
    createdAt: toDate(parsed.data.createdAt),
    updatedAt: toDate(parsed.data.updatedAt),
    createdBy: parsed.data.createdBy,
    form: parsed.data.form,
    result: parsed.data.result,
  };
}

/**
 * Persists a new trip quote. Returns the Firestore document id.
 * TODO: atomic COT-XXXX counter when product requires sequential numbers.
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
    });

    return ref.id;
  } catch (error) {
    mapFirebaseError(error, "createTripQuote");
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
