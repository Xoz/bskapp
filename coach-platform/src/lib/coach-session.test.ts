import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { verifyCoachBridge } from "./bridge-auth";

const secret = "bridge-test-secret";
const payload = JSON.stringify({ id: "coach-1", name: "Test Tränare", role: "head_coach" });
const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

describe("verifyCoachBridge", () => {
  it("godkänner en korrekt signerad tränaridentitet", () => {
    expect(verifyCoachBridge(payload, signature, secret)).toEqual({
      id: "coach-1",
      name: "Test Tränare",
      role: "head_coach",
    });
  });

  it("avvisar manipulerad payload och signatur med fel längd", () => {
    expect(verifyCoachBridge(payload.replace("coach-1", "coach-2"), signature, secret)).toBeNull();
    expect(verifyCoachBridge(payload, "deadbeef", secret)).toBeNull();
  });

  it("avvisar trasig JSON och otillåten roll", () => {
    const broken = "{";
    const brokenSignature = crypto.createHmac("sha256", secret).update(broken).digest("hex");
    expect(verifyCoachBridge(broken, brokenSignature, secret)).toBeNull();

    const adminPayload = JSON.stringify({ id: "coach-1", name: "Test", role: "admin" });
    const adminSignature = crypto.createHmac("sha256", secret).update(adminPayload).digest("hex");
    expect(verifyCoachBridge(adminPayload, adminSignature, secret)).toBeNull();
  });
});
