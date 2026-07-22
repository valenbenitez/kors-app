import type { SessionPayload } from "@/lib/auth/token";
import type { TripQuoteDoc } from "@/lib/firebase/trip-quotes/types";

/**
 * Trip-quote read access policy (PRD P1)
 * ----------------------------------------
 * - Unauthenticated → API returns 401 (handled at route layer).
 * - Seller: may get/list only quotes where `createdBy.uid === session.sub`.
 * - Admin: may get/list all quotes. Detected via Firebase custom claim
 *   `admin === true` (on session) OR email listed in `ADMIN_EMAILS`
 *   (comma-separated, case-insensitive).
 * - Authenticated but not owner and not admin → 403.
 *
 * Client Firestore rules remain deny-all; enforcement is API-only (Admin SDK).
 * See also `docs/auth-quotes.md`.
 */

/** Parses `ADMIN_EMAILS` env into a lowercase email set. */
export function parseAdminEmails(
  raw: string | undefined = process.env.ADMIN_EMAILS,
): Set<string> {
  if (!raw?.trim()) {
    return new Set();
  }
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0),
  );
}

/**
 * True when the session is an admin (custom claim or ADMIN_EMAILS).
 */
export function isAdmin(session: SessionPayload): boolean {
  if (session.admin === true) {
    return true;
  }
  return parseAdminEmails().has(session.email.toLowerCase());
}

/**
 * True when the session may read this trip quote (owner or admin).
 */
export function canReadTripQuote(
  session: SessionPayload,
  doc: Pick<TripQuoteDoc, "createdBy">,
): boolean {
  if (isAdmin(session)) {
    return true;
  }
  return doc.createdBy.uid === session.sub;
}
