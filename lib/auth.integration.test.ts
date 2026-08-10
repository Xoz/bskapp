import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieValues: new Map<string, string>(),
  get: vi.fn(),
  all: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: (name: string) => {
    const value = mocks.cookieValues.get(name);
    return value ? { value } : undefined;
  } })),
}));
vi.mock("./db", () => ({ get: mocks.get, all: mocks.all }));

async function authenticatedModule(userId: number) {
  const auth = await import("./auth");
  mocks.cookieValues.set("bsk_session", auth.userSessionToken(userId));
  return auth;
}

describe("roll- och gruppauktorisering", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.cookieValues.clear();
    mocks.get.mockReset();
    mocks.all.mockReset();
    process.env.SESSION_SECRET = "test-secret-with-at-least-32-characters";
  });

  it("begränsar tränare till direkt grupp, undergrupp och deras spelare", async () => {
    mocks.get.mockImplementation(async (query: string, args: unknown[]) => {
      if (query.includes("FROM users")) return { id: 7, email: "coach@example.test", name: "Coach" };
      if (query.includes("FROM groups g")) return args[1] === 11 ? { ok: 1 } : undefined;
      if (query.includes("FROM player_group_memberships")) return args[1] === 101 ? { ok: 1 } : undefined;
      return undefined;
    });
    mocks.all.mockImplementation(async (query: string) => {
      if (query.includes("FROM user_roles")) return [{ role: "coach" }];
      if (query.includes("FROM user_permissions")) return [];
      if (query.includes("FROM user_group_access")) return [{ group_id: 10 }];
      return [];
    });
    const auth = await authenticatedModule(7);

    expect(await auth.canAccessGroup(10)).toBe(true);
    expect(await auth.canAccessGroup(11)).toBe(true);
    expect(await auth.canAccessGroup(12)).toBe(false);
    expect(await auth.canAccessPlayer(101)).toBe(true);
    expect(await auth.canAccessPlayer(102)).toBe(false);
  });

  it("låter förälder endast läsa uttryckligen kopplat barn", async () => {
    mocks.get.mockImplementation(async (query: string, args: unknown[]) => {
      if (query.includes("FROM users")) return { id: 8, email: "parent@example.test", name: "Förälder" };
      if (query.includes("FROM user_player_links")) return args[1] === 201 ? { ok: 1 } : undefined;
      return undefined;
    });
    mocks.all.mockImplementation(async (query: string) => {
      if (query.includes("FROM user_roles")) return [{ role: "parent" }];
      return [];
    });
    const auth = await authenticatedModule(8);

    expect(await auth.canAccessPlayer(201)).toBe(true);
    expect(await auth.canAccessPlayer(202)).toBe(false);
    expect(await auth.hasPermission("view_players")).toBe(false);
  });

  it("ignorerar deny-override för admin men respekterar den för tränare", async () => {
    async function permissionsFor(userId: number, role: "admin" | "coach") {
      vi.resetModules();
      mocks.cookieValues.clear();
      mocks.get.mockImplementation(async (query: string) => query.includes("FROM users") ? { id: userId, email: `${role}@example.test`, name: role } : undefined);
      mocks.all.mockImplementation(async (query: string) => {
        if (query.includes("FROM user_roles")) return [{ role }];
        if (query.includes("FROM user_permissions")) return [{ permission_key: "view_players", allowed: 0 }];
        return [];
      });
      const auth = await authenticatedModule(userId);
      return auth.hasPermission("view_players");
    }

    expect(await permissionsFor(9, "admin")).toBe(true);
    expect(await permissionsFor(10, "coach")).toBe(false);
  });
});
