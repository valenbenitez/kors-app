import { jwtVerify, SignJWT } from "jose";
import { getEnv } from "@/lib/env";

export const SESSION_COOKIE = "kors-session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export type SessionPayload = {
  email: string;
  sub: string;
};

function getSecretKey() {
  return new TextEncoder().encode(getEnv().SESSION_SECRET);
}

export async function createSessionToken(email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(email)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    const email = payload.email;

    if (typeof email !== "string" || typeof payload.sub !== "string") {
      return null;
    }

    return { email, sub: payload.sub };
  } catch {
    return null;
  }
}
