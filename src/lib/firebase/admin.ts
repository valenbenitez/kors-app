import {
  type App,
  cert,
  getApps,
  initializeApp,
  type ServiceAccount,
} from "firebase-admin/app";
import { type Auth, type DecodedIdToken, getAuth } from "firebase-admin/auth";
import { type Firestore, getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminEnv, isFirestoreEmulator } from "@/lib/env";
import { FirebaseConfigError, mapFirebaseError } from "@/lib/firebase/errors";

const GLOBAL_APP_KEY = "__kors_firebase_admin_app__" as const;
const GLOBAL_DB_KEY = "__kors_firebase_admin_firestore__" as const;
const GLOBAL_AUTH_KEY = "__kors_firebase_admin_auth__" as const;

type AdminGlobal = typeof globalThis & {
  [GLOBAL_APP_KEY]?: App;
  [GLOBAL_DB_KEY]?: Firestore;
  [GLOBAL_AUTH_KEY]?: Auth;
};

function getAdminGlobal(): AdminGlobal {
  return globalThis as AdminGlobal;
}

/**
 * Lazy singleton Firebase Admin app.
 * Survives Next.js / Vitest HMR via `globalThis`.
 */
export function getAdminApp(): App {
  const g = getAdminGlobal();
  if (g[GLOBAL_APP_KEY]) {
    return g[GLOBAL_APP_KEY];
  }

  const existing = getApps();
  if (existing.length > 0) {
    g[GLOBAL_APP_KEY] = existing[0];
    return existing[0];
  }

  try {
    const env = getFirebaseAdminEnv();

    if (isFirestoreEmulator()) {
      // Project-only init is enough for the emulator; credential is unused.
      g[GLOBAL_APP_KEY] = initializeApp({
        projectId: env.FIREBASE_PROJECT_ID,
      });
      return g[GLOBAL_APP_KEY];
    }

    const serviceAccount: ServiceAccount = {
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY,
    };

    g[GLOBAL_APP_KEY] = initializeApp({
      credential: cert(serviceAccount),
      projectId: env.FIREBASE_PROJECT_ID,
    });
    return g[GLOBAL_APP_KEY];
  } catch (error) {
    if (error instanceof FirebaseConfigError) {
      throw error;
    }
    mapFirebaseError(error, "getAdminApp");
  }
}

/** Lazy singleton Admin Auth. Do not import from client components. */
export function getAdminAuth(): Auth {
  const g = getAdminGlobal();
  if (g[GLOBAL_AUTH_KEY]) {
    return g[GLOBAL_AUTH_KEY];
  }

  try {
    const app = getAdminApp();
    g[GLOBAL_AUTH_KEY] = getAuth(app);
    return g[GLOBAL_AUTH_KEY];
  } catch (error) {
    if (error instanceof FirebaseConfigError) {
      throw error;
    }
    mapFirebaseError(error, "getAdminAuth");
  }
}

/** Lazy singleton Admin Firestore. Do not import from client components. */
export function getAdminFirestore(): Firestore {
  const g = getAdminGlobal();
  if (g[GLOBAL_DB_KEY]) {
    return g[GLOBAL_DB_KEY];
  }

  try {
    const app = getAdminApp();
    g[GLOBAL_DB_KEY] = getFirestore(app);
    return g[GLOBAL_DB_KEY];
  } catch (error) {
    if (error instanceof FirebaseConfigError) {
      throw error;
    }
    mapFirebaseError(error, "getAdminFirestore");
  }
}

/** Verifies a Firebase ID token from the client SDK. */
export async function verifyIdToken(idToken: string): Promise<DecodedIdToken> {
  try {
    return await getAdminAuth().verifyIdToken(idToken);
  } catch (error) {
    mapFirebaseError(error, "verifyIdToken");
  }
}

/**
 * Creates a Firebase session cookie from a verified ID token.
 * @param expiresInMs - Cookie lifetime in milliseconds (5 min – 14 days).
 */
export async function createSessionCookie(
  idToken: string,
  expiresInMs: number,
): Promise<string> {
  try {
    return await getAdminAuth().createSessionCookie(idToken, {
      expiresIn: expiresInMs,
    });
  } catch (error) {
    mapFirebaseError(error, "createSessionCookie");
  }
}

/**
 * Verifies a Firebase session cookie.
 * @param checkRevoked - When true, also checks token revocation.
 */
export async function verifySessionCookie(
  sessionCookie: string,
  checkRevoked = true,
): Promise<DecodedIdToken> {
  try {
    return await getAdminAuth().verifySessionCookie(
      sessionCookie,
      checkRevoked,
    );
  } catch (error) {
    mapFirebaseError(error, "verifySessionCookie");
  }
}

/** Revokes all refresh tokens for a user (invalidates existing sessions). */
export async function revokeRefreshTokens(uid: string): Promise<void> {
  try {
    await getAdminAuth().revokeRefreshTokens(uid);
  } catch (error) {
    mapFirebaseError(error, "revokeRefreshTokens");
  }
}
