import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  type SessionPayload,
  verifySessionToken,
} from "@/lib/auth/token";
import { revokeRefreshTokens } from "@/lib/firebase/admin";

export {
  createSessionToken,
  SESSION_COOKIE,
  type SessionPayload,
  verifySessionToken,
} from "@/lib/auth/token";

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Clears the session cookie and best-effort revokes Firebase refresh tokens.
 */
export async function destroySession(): Promise<void> {
  const session = await getSession();

  await clearSessionCookie();

  if (session?.sub) {
    try {
      await revokeRefreshTokens(session.sub);
    } catch {
      // Cookie already cleared; revocation failure must not block logout.
    }
  }
}
