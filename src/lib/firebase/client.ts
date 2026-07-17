import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import {
  connectFirestoreEmulator,
  type Firestore,
  getFirestore,
} from "firebase/firestore";
import { getFirebaseClientEnv, isFirestoreEmulator } from "@/lib/env";
import { FirebaseConfigError, mapFirebaseError } from "@/lib/firebase/errors";

let appSingleton: FirebaseApp | undefined;
let firestoreSingleton: Firestore | undefined;
let emulatorConnected = false;

/**
 * Lazy singleton Firebase web app. Safe for HMR — reuses existing app.
 * Call only from client components / client-only modules (not Admin).
 */
export function getFirebaseApp(): FirebaseApp {
  if (appSingleton) {
    return appSingleton;
  }

  if (getApps().length > 0) {
    appSingleton = getApps()[0];
    return appSingleton;
  }

  try {
    const env = getFirebaseClientEnv();
    appSingleton = initializeApp({
      apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
    });
    return appSingleton;
  } catch (error) {
    if (error instanceof FirebaseConfigError) {
      throw error;
    }
    mapFirebaseError(error, "getFirebaseApp");
  }
}

/**
 * Lazy singleton client Firestore.
 * When `FIRESTORE_EMULATOR_HOST` is set, connects to the local emulator once.
 */
export function getClientFirestore(): Firestore {
  if (firestoreSingleton) {
    return firestoreSingleton;
  }

  try {
    const app = getFirebaseApp();
    firestoreSingleton = getFirestore(app);

    if (isFirestoreEmulator() && !emulatorConnected) {
      const hostEnv = process.env.FIRESTORE_EMULATOR_HOST?.trim() ?? "";
      const [host, portStr] = hostEnv.split(":");
      const port = Number(portStr);
      if (host && Number.isFinite(port)) {
        connectFirestoreEmulator(firestoreSingleton, host, port);
        emulatorConnected = true;
      }
    }

    return firestoreSingleton;
  } catch (error) {
    if (error instanceof FirebaseConfigError) {
      throw error;
    }
    mapFirebaseError(error, "getClientFirestore");
  }
}
