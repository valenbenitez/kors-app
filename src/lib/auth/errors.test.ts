import { describe, expect, test } from "vitest";
import { toUserFacingAuthError } from "@/lib/auth/errors";

describe("toUserFacingAuthError", () => {
  test("maps invalid credentials to a clear Spanish message", () => {
    expect(toUserFacingAuthError({ code: "auth/invalid-credential" })).toBe(
      "Email o contraseña incorrectos",
    );
  });

  test("does not leak internal Firebase messages", () => {
    const message = toUserFacingAuthError({
      code: "auth/internal-error",
      message: "Firebase: INTERNAL ASSERTION FAILED (stacktrace)",
    });

    expect(message).toBe("No se pudo iniciar sesión");
    expect(message).not.toContain("INTERNAL");
    expect(message).not.toContain("Firebase");
  });

  test("maps rate limiting to a friendly message", () => {
    expect(toUserFacingAuthError({ code: "auth/too-many-requests" })).toBe(
      "Demasiados intentos. Probá de nuevo en unos minutos",
    );
  });
});
