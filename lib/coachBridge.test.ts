import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { signCoachBridge } from "./coachBridge";
import { verifyCoachBridge } from "../coach-platform/src/lib/bridge-auth";

describe("signCoachBridge", () => {
  it("skapar ASCII-säker, kortlivad och verifierbar payload", () => {
    const secret = "bridge-test-secret";
    const { payload, signature } = signCoachBridge({ id: "7", name: "Åsa Tränare", role: "head_coach" }, secret, 1234);
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(signature).toBe(crypto.createHmac("sha256", secret).update(payload).digest("hex"));
    expect(JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))).toEqual({ id: "7", name: "Åsa Tränare", role: "head_coach", issuedAt: 1234 });
    expect(verifyCoachBridge(payload, signature, secret, 1234)).toEqual({ id: "7", name: "Åsa Tränare", role: "head_coach" });
  });
});
