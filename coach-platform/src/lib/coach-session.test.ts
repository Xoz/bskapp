import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { verifyCoachBridge } from "./bridge-auth";

const secret = "bridge-test-secret";
const now = Date.now();
const payload = Buffer.from(JSON.stringify({ id: "coach-1", name: "Test Tränare", role: "head_coach", issuedAt: now })).toString("base64url");
const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

describe("verifyCoachBridge", () => {
  it("godkänner en korrekt signerad tränaridentitet", () => {
    expect(verifyCoachBridge(payload, signature, secret, now)).toEqual({
      id: "coach-1",
      name: "Test Tränare",
      role: "head_coach",
    });
  });

  it("avvisar manipulerad payload och signatur med fel längd", () => {
    expect(verifyCoachBridge(`${payload}A`, signature, secret, now)).toBeNull();
    expect(verifyCoachBridge(payload, "deadbeef", secret)).toBeNull();
  });

  it("avvisar trasig JSON och otillåten roll", () => {
    const broken = Buffer.from("{").toString("base64url");
    const brokenSignature = crypto.createHmac("sha256", secret).update(broken).digest("hex");
    expect(verifyCoachBridge(broken, brokenSignature, secret)).toBeNull();

    const adminPayload = Buffer.from(JSON.stringify({ id: "coach-1", name: "Test", role: "admin", issuedAt: now })).toString("base64url");
    const adminSignature = crypto.createHmac("sha256", secret).update(adminPayload).digest("hex");
    expect(verifyCoachBridge(adminPayload, adminSignature, secret)).toBeNull();
  });

  it("avvisar utgångna identiteter", () => {
    expect(verifyCoachBridge(payload, signature, secret, now + 90_001)).toBeNull();
  });
});
