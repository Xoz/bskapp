import crypto from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), run: vi.fn(), user: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ get: mocks.get, run: mocks.run }));
vi.mock("./auth", () => ({
  loadCurrentUserById: mocks.user,
  userSessionToken: (id: number) => `signed-${id}`,
  coachEmailToken: () => "signed-email",
}));

const verifier = "a".repeat(43);
const code = "b".repeat(43);
const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
const user = { id: 7, name: "Testtränare", email: "coach@example.invalid", primaryRole: "coach" };

describe("Mac-inloggning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue({ user_id: 7, code_challenge: challenge });
    mocks.run.mockResolvedValue([{ user_id: 7 }]);
    mocks.user.mockResolvedValue(user);
  });

  it("kräver korrekt PKCE och förbrukar koden utan att skapa enhetstokens", async () => {
    const { exchangeDesktopAuthCode } = await import("./mobileAuth");
    expect(await exchangeDesktopAuthCode(code, verifier)).toEqual(user);
    expect(mocks.run).toHaveBeenCalledTimes(1);
    expect(mocks.run.mock.calls[0][0]).toContain("consumed_at IS NULL");
    expect(mocks.get.mock.calls[0][0]).toContain("expires_at > now()");
  });

  it("nekar fel verifierare utan att förbruka koden", async () => {
    const { exchangeDesktopAuthCode } = await import("./mobileAuth");
    expect(await exchangeDesktopAuthCode(code, "c".repeat(43))).toBeNull();
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("nekar saknad, utgången och redan förbrukad kod", async () => {
    const { exchangeDesktopAuthCode } = await import("./mobileAuth");
    mocks.get.mockResolvedValue(null);
    expect(await exchangeDesktopAuthCode(code, verifier)).toBeNull();
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("nekar ett konkurrerande andra kodutbyte", async () => {
    const { exchangeDesktopAuthCode } = await import("./mobileAuth");
    mocks.run.mockResolvedValueOnce([{ user_id: 7 }]).mockResolvedValueOnce([]);
    expect(await exchangeDesktopAuthCode(code, verifier)).toEqual(user);
    expect(await exchangeDesktopAuthCode(code, verifier)).toBeNull();
  });

  it("nekar inaktiverat konto och ogiltigt kodformat", async () => {
    const { exchangeDesktopAuthCode } = await import("./mobileAuth");
    expect(await exchangeDesktopAuthCode("bad", verifier)).toBeNull();
    expect(mocks.get).not.toHaveBeenCalled();
    mocks.user.mockResolvedValue(null);
    expect(await exchangeDesktopAuthCode(code, verifier)).toBeNull();
  });

  it("sätter skyddade cookies och förbjuder cachning", async () => {
    const { POST } = await import("../app/api/auth/desktop/exchange/route");
    const response = await POST(new Request("https://bsk2014.se/api/auth/desktop/exchange", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, codeVerifier: verifier }),
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.cookies.get("bsk_session")).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    expect(await response.json()).toEqual({ destination: "/idag" });
  });

  it("ger inga cookies vid fel, fel JSON eller cross-site-formulär", async () => {
    const { POST } = await import("../app/api/auth/desktop/exchange/route");
    for (const [type, body, status] of [
      ["text/plain", "{}", 415],
      ["application/json", "broken", 400],
      ["application/json", '{}', 400],
      ["application/json", '{"code":"bad","codeVerifier":"bad"}', 401],
    ] as const) {
      const response = await POST(new Request("https://bsk2014.se/api/auth/desktop/exchange", {
        method: "POST", headers: { "Content-Type": type }, body,
      }));
      expect(response.status).toBe(status);
      expect(response.headers.get("set-cookie")).toBeNull();
    }
  });

  it("behåller spelarens eller förälderns begränsade ingång", async () => {
    const { POST } = await import("../app/api/auth/desktop/exchange/route");
    mocks.user.mockResolvedValue({ ...user, primaryRole: "parent" });
    const response = await POST(new Request("https://bsk2014.se/api/auth/desktop/exchange", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, codeVerifier: verifier }),
    }));
    expect(await response.json()).toEqual({ destination: "/mina-spelare" });
  });
});
