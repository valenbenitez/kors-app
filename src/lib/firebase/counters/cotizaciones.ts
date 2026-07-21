import { getAdminFirestore } from "@/lib/firebase/admin";
import { COUNTER_TRIP_QUOTES, COUNTERS } from "@/lib/firebase/collections";
import { mapFirebaseError } from "@/lib/firebase/errors";

/** Formats a sequential integer as `COT-XXXX` (4+ digits, zero-padded). */
export function formatCotNumber(seq: number): string {
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error(`Invalid cot sequence: ${seq}`);
  }
  return `COT-${String(seq).padStart(4, "0")}`;
}

/**
 * Atomically allocates the next COT-XXXX via Firestore transaction on
 * `counters/tripQuotes` (`seq` field).
 */
export async function allocateCotNumber(): Promise<string> {
  try {
    const db = getAdminFirestore();
    const counterRef = db.collection(COUNTERS).doc(COUNTER_TRIP_QUOTES);

    const cotNumber = await db.runTransaction(async (tx) => {
      const snap = await tx.get(counterRef);
      const current =
        snap.exists && typeof snap.data()?.seq === "number"
          ? (snap.data()?.seq as number)
          : 0;
      const next = current + 1;
      tx.set(counterRef, { seq: next }, { merge: true });
      return formatCotNumber(next);
    });

    return cotNumber;
  } catch (error) {
    mapFirebaseError(error, "allocateCotNumber");
  }
}
