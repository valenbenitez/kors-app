import { beforeEach, describe, expect, test, vi } from "vitest";

const verifyIdToken = vi.fn();
const createSessionToken = vi.fn();
const setSessionCookie = vi.fn();

vi.mock("@/lib/firebase/admin", () => ({
  verifyIdToken: (...args: unknown[]) => verifyIdToken(...args),
}));

vi.mock("@/lib/auth/session", () => ({
  createSessionToken: (...args: unknown[]) => createSessionToken(...args),
  setSessionCookie: (...args: unknown[]) => setSessionCookie(...args),
}));

import { POST } from "@/app/api/auth/login/route";
import { FirebaseDomainError } from "@/lib/firebase/errors";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns ok when the ID token is valid", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-1", email: "a@kors.com" });
    createSessionToken.mockResolvedValue("session-cookie");
    setSessionCookie.mockResolvedValue(undefined);

    const response = await POST(jsonRequest({ idToken: "valid-id-token" }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(verifyIdToken).toHaveBeenCalledWith("valid-id-token");
    expect(createSessionToken).toHaveBeenCalledWith("valid-id-token");
    expect(setSessionCookie).toHaveBeenCalledWith("session-cookie");
  });

  test("returns 401 when the ID token is invalid", async () => {
    verifyIdToken.mockRejectedValue(
      new FirebaseDomainError("verifyIdToken: auth/argument-error"),
    );

    const response = await POST(jsonRequest({ idToken: "bad-token" }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Email o contraseña incorrectos");
    expect(data.error).not.toContain("argument-error");
    expect(setSessionCookie).not.toHaveBeenCalled();
  });

  test("returns 400 when idToken is missing", async () => {
    const response = await POST(jsonRequest({}));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(typeof data.error).toBe("string");
    expect(verifyIdToken).not.toHaveBeenCalled();
  });
});
