/**
 * Maps client Firebase Auth errors to Spanish UI copy.
 * Never returns raw Firebase / SDK messages to the user.
 */
export function toUserFacingAuthError(error: unknown): string {
  const code = extractAuthErrorCode(error);

  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
    case "auth/user-disabled":
      return "Email o contraseña incorrectos";
    case "auth/too-many-requests":
      return "Demasiados intentos. Probá de nuevo en unos minutos";
    case "auth/network-request-failed":
      return "No se pudo conectar. Revisá tu conexión e intentá de nuevo";
    default:
      return "No se pudo iniciar sesión";
  }
}

function extractAuthErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  if (
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }

  return undefined;
}
