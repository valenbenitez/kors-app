/** Base domain error for Firebase / Firestore failures. */
export class FirebaseDomainError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "FirebaseDomainError";
  }
}

/** Thrown when a trip quote document does not exist. */
export class TripQuoteNotFoundError extends FirebaseDomainError {
  readonly id: string;

  constructor(id: string) {
    super(`Trip quote not found: ${id}`);
    this.name = "TripQuoteNotFoundError";
    this.id = id;
  }
}

/** Thrown when a Firestore document fails schema validation. */
export class TripQuoteValidationError extends FirebaseDomainError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "TripQuoteValidationError";
  }
}

/** Thrown when Firebase env / init configuration is invalid. */
export class FirebaseConfigError extends FirebaseDomainError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "FirebaseConfigError";
  }
}

type FirebaseLikeError = {
  code?: string;
  message?: string;
};

function isFirebaseLikeError(error: unknown): error is FirebaseLikeError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as FirebaseLikeError).code === "string"
  );
}

/**
 * Maps low-level Firebase / Firestore errors to domain errors.
 * Re-throws existing FirebaseDomainError subclasses unchanged.
 */
export function mapFirebaseError(error: unknown, context?: string): never {
  if (error instanceof FirebaseDomainError) {
    throw error;
  }

  const prefix = context ? `${context}: ` : "";

  if (isFirebaseLikeError(error)) {
    const code = error.code ?? "unknown";
    const detail = error.message ?? "unknown error";
    throw new FirebaseDomainError(`${prefix}Firebase [${code}] ${detail}`, {
      cause: error,
    });
  }

  const detail =
    error instanceof Error ? error.message : "unknown Firebase error";
  throw new FirebaseDomainError(`${prefix}${detail}`, { cause: error });
}
