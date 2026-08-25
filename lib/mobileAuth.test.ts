import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({
  get: vi.fn(),
  run: mocks.run,
}));
vi.mock("./auth", () => ({
  loadCurrentUserById: vi.fn(),
}));

describe("native sessionsförnyelse", () => {
  beforeEach(() => {
    mocks.run.mockReset();
    mocks.run.mockResolvedValue([{ id: "session-1" }]);
  });

  it("behåller refresh-token så samtidiga omförsök är idempotenta", async () => {
    const { refreshMobileSession } = await import("./mobileAuth");
    const refreshToken = "a".repeat(43);

    const first = await refreshMobileSession(refreshToken);
    const second = await refreshMobileSession(refreshToken);

    expect(first?.refreshToken).toBe(refreshToken);
    expect(second?.refreshToken).toBe(refreshToken);
    expect(mocks.run).toHaveBeenCalledTimes(2);
    for (const [sql] of mocks.run.mock.calls) {
      expect(sql).not.toContain("SET revoked_at = now()");
      expect(sql).not.toContain("previous_refresh_token_hash = refresh_token_hash");
      expect(sql).not.toContain("refresh_token_hash = ?,");
    }
  });
});
