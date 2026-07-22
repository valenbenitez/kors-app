import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { SessionPayload } from "@/lib/auth/token";
import {
  canReadTripQuote,
  isAdmin,
  parseAdminEmails,
} from "@/lib/firebase/trip-quotes/access";

describe("parseAdminEmails", () => {
  test("returns empty set when unset or blank", () => {
    expect(parseAdminEmails(undefined).size).toBe(0);
    expect(parseAdminEmails("").size).toBe(0);
    expect(parseAdminEmails("  ").size).toBe(0);
  });

  test("parses comma-separated emails case-insensitively", () => {
    expect(parseAdminEmails("a@kors.com, B@Kors.com")).toEqual(
      new Set(["a@kors.com", "b@kors.com"]),
    );
  });
});

describe("isAdmin", () => {
  const prev = process.env.ADMIN_EMAILS;

  afterEach(() => {
    if (prev === undefined) {
      delete process.env.ADMIN_EMAILS;
    } else {
      process.env.ADMIN_EMAILS = prev;
    }
  });

  test("true when session has admin custom claim", () => {
    delete process.env.ADMIN_EMAILS;
    const session: SessionPayload = {
      email: "seller@kors.com",
      sub: "uid-1",
      admin: true,
    };
    expect(isAdmin(session)).toBe(true);
  });

  test("true when email is in ADMIN_EMAILS", () => {
    process.env.ADMIN_EMAILS = "admin@kors.com, other@kors.com";
    const session: SessionPayload = {
      email: "Admin@kors.com",
      sub: "uid-1",
    };
    expect(isAdmin(session)).toBe(true);
  });

  test("false for ordinary seller", () => {
    process.env.ADMIN_EMAILS = "admin@kors.com";
    const session: SessionPayload = {
      email: "seller@kors.com",
      sub: "uid-1",
    };
    expect(isAdmin(session)).toBe(false);
  });
});

describe("canReadTripQuote", () => {
  const prev = process.env.ADMIN_EMAILS;

  beforeEach(() => {
    delete process.env.ADMIN_EMAILS;
  });

  afterEach(() => {
    if (prev === undefined) {
      delete process.env.ADMIN_EMAILS;
    } else {
      process.env.ADMIN_EMAILS = prev;
    }
  });

  const doc = {
    createdBy: { uid: "owner-uid", email: "owner@kors.com" },
  };

  test("owner can read own quote", () => {
    expect(
      canReadTripQuote({ email: "owner@kors.com", sub: "owner-uid" }, doc),
    ).toBe(true);
  });

  test("other seller cannot read", () => {
    expect(
      canReadTripQuote({ email: "other@kors.com", sub: "other-uid" }, doc),
    ).toBe(false);
  });

  test("admin can read any quote via claim", () => {
    expect(
      canReadTripQuote(
        { email: "admin@kors.com", sub: "admin-uid", admin: true },
        doc,
      ),
    ).toBe(true);
  });

  test("admin can read any quote via ADMIN_EMAILS", () => {
    process.env.ADMIN_EMAILS = "boss@kors.com";
    expect(
      canReadTripQuote({ email: "boss@kors.com", sub: "boss-uid" }, doc),
    ).toBe(true);
  });
});
