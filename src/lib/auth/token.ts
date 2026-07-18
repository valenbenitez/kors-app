import { createSessionCookie, verifySessionCookie } from "@/lib/firebase/admin";

export const SESSION_COOKIE = "kors-session";

/** Session cookie lifetime in seconds (7 days). Firebase allows 5 min – 14 days. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export type SessionPayload = {
  email: string;
  sub: string;
};

/**
 * Exchanges a Firebase ID token for a Firebase session cookie value.
 */
export async function createSessionToken(idToken: string): Promise<string> {
  return createSessionCookie(idToken, SESSION_MAX_AGE * 1000);
}

/**
 * Verifies a Firebase session cookie and returns a normalized payload.
 * Returns null when the cookie is missing, expired, revoked, or invalid.
 */
export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const decoded = await verifySessionCookie(token, true);
    const email = decoded.email;

    if (typeof email !== "string" || typeof decoded.uid !== "string") {
      return null;
    }

    return { email, sub: decoded.uid };
  } catch {
    return null;
  }
}
