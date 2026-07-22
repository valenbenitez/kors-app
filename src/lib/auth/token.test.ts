import { beforeEach, describe, expect, test, vi } from "vitest";

const verifySessionCookie = vi.fn();
const createSessionCookie = vi.fn();

vi.mock("@/lib/firebase/admin", () => ({
  verifySessionCookie: (...args: unknown[]) => verifySessionCookie(...args),
  createSessionCookie: (...args: unknown[]) => createSessionCookie(...args),
}));

import {
  createSessionToken,
  SESSION_MAX_AGE,
  verifySessionToken,
} from "@/lib/auth/token";
import { FirebaseDomainError } from "@/lib/firebase/errors";

describe("createSessionToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates a Firebase session cookie from an ID token", async () => {
    createSessionCookie.mockResolvedValue("session-cookie-value");

    const cookie = await createSessionToken("id-token");

    expect(cookie).toBe("session-cookie-value");
    expect(createSessionCookie).toHaveBeenCalledWith(
      "id-token",
      SESSION_MAX_AGE * 1000,
    );
  });
});

describe("verifySessionToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns a session payload for a valid cookie", async () => {
    verifySessionCookie.mockResolvedValue({
      email: "seller@kors.com",
      uid: "uid-123",
    });

    await expect(verifySessionToken("valid-cookie")).resolves.toEqual({
      email: "seller@kors.com",
      sub: "uid-123",
    });
    expect(verifySessionCookie).toHaveBeenCalledWith("valid-cookie", true);
  });

  test("includes admin when custom claim is true", async () => {
    verifySessionCookie.mockResolvedValue({
      email: "admin@kors.com",
      uid: "uid-admin",
      admin: true,
    });

    await expect(verifySessionToken("admin-cookie")).resolves.toEqual({
      email: "admin@kors.com",
      sub: "uid-admin",
      admin: true,
    });
  });

  test("returns null when the cookie is invalid", async () => {
    verifySessionCookie.mockRejectedValue(
      new FirebaseDomainError("verifySessionCookie: invalid"),
    );

    await expect(verifySessionToken("bad-cookie")).resolves.toBeNull();
  });

  test("returns null when email is missing from claims", async () => {
    verifySessionCookie.mockResolvedValue({
      uid: "uid-123",
    });

    await expect(verifySessionToken("no-email")).resolves.toBeNull();
  });
});
