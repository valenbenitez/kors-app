import { z } from "zod";
import { FirebaseConfigError } from "@/lib/firebase/errors";

const envSchema = z.object({
  PDF_RUNTIME: z.enum(["local", "serverless"]).default("local"),
  PUPPETEER_EXECUTABLE_PATH: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(
      `Invalid or missing environment variables: ${missing}. Copy .env.example to .env.local and configure values.`,
    );
  }

  return parsed.data;
}

/** Server-only validated env. Throws at runtime if vars are missing. */
export function getEnv(): Env {
  return loadEnv();
}

/** True when deployed to a serverless platform (Vercel, etc.). */
export function isServerlessPdfRuntime(): boolean {
  return process.env.PDF_RUNTIME === "serverless" || process.env.VERCEL === "1";
}

/** True when connecting Admin / client SDK to the Firestore emulator. */
export function isFirestoreEmulator(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST?.trim());
}

const firebaseAdminEnvSchema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
});

export type FirebaseAdminEnv = z.infer<typeof firebaseAdminEnvSchema>;

const EMULATOR_ADMIN_DEFAULTS: FirebaseAdminEnv = {
  FIREBASE_PROJECT_ID: "demo-kors",
  FIREBASE_CLIENT_EMAIL: "firebase-adminsdk@demo-kors.iam.gserviceaccount.com",
  // Dummy PEM — Admin SDK against the emulator does not verify this key.
  FIREBASE_PRIVATE_KEY:
    "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7\n-----END PRIVATE KEY-----\n",
};

/**
 * Normalizes FIREBASE_PRIVATE_KEY from `.env` (escaped `\n` → real newlines).
 */
export function normalizeFirebasePrivateKey(raw: string): string {
  return raw.replace(/\\n/g, "\n");
}

/**
 * Server-only Firebase Admin credentials.
 * When `FIRESTORE_EMULATOR_HOST` is set, missing vars fall back to safe demos.
 */
export function getFirebaseAdminEnv(): FirebaseAdminEnv {
  if (isFirestoreEmulator()) {
    const projectId =
      process.env.FIREBASE_PROJECT_ID?.trim() ||
      EMULATOR_ADMIN_DEFAULTS.FIREBASE_PROJECT_ID;
    const clientEmail =
      process.env.FIREBASE_CLIENT_EMAIL?.trim() ||
      EMULATOR_ADMIN_DEFAULTS.FIREBASE_CLIENT_EMAIL;
    const privateKeyRaw =
      process.env.FIREBASE_PRIVATE_KEY?.trim() ||
      EMULATOR_ADMIN_DEFAULTS.FIREBASE_PRIVATE_KEY;

    return {
      FIREBASE_PROJECT_ID: projectId,
      FIREBASE_CLIENT_EMAIL: clientEmail,
      FIREBASE_PRIVATE_KEY: normalizeFirebasePrivateKey(privateKeyRaw),
    };
  }

  const parsed = firebaseAdminEnvSchema.safeParse({
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY
      ? normalizeFirebasePrivateKey(process.env.FIREBASE_PRIVATE_KEY)
      : undefined,
  });

  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new FirebaseConfigError(
      `Invalid or missing Firebase Admin env: ${missing}. Copy .env.example to .env.local.`,
    );
  }

  return parsed.data;
}

const firebaseClientEnvSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
});

export type FirebaseClientEnv = z.infer<typeof firebaseClientEnvSchema>;

/**
 * Client (web) Firebase config — validated lazily on first client SDK init.
 * Does not run during Next boot / SSR of pages that never call the client SDK.
 */
export function getFirebaseClientEnv(): FirebaseClientEnv {
  const parsed = firebaseClientEnvSchema.safeParse({
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID:
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });

  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new FirebaseConfigError(
      `Invalid or missing Firebase client env: ${missing}. Copy .env.example to .env.local.`,
    );
  }

  return parsed.data;
}
