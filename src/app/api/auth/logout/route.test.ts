import { beforeEach, describe, expect, test, vi } from "vitest";

const destroySession = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  destroySession: (...args: unknown[]) => destroySession(...args),
}));

import { POST } from "@/app/api/auth/logout/route";

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    destroySession.mockResolvedValue(undefined);
  });

  test("destroys the server session and returns ok", async () => {
    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(destroySession).toHaveBeenCalledOnce();
  });
});
