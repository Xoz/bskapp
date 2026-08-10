import crypto from "node:crypto";

export type CoachBridgeRole = "head_coach" | "assistant_coach";

export function signCoachBridge(identity: { id: string; name: string; role: CoachBridgeRole }, secret: string, issuedAt = Date.now()) {
  if (!secret) throw new Error("BSK_SESSION_BRIDGE_SECRET saknas.");
  const payload = Buffer.from(JSON.stringify({ ...identity, issuedAt }), "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return { payload, signature };
}
