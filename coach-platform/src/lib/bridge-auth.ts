import crypto from "crypto";

export type CoachIdentity = { id: string; name: string; role: "head_coach" | "assistant_coach" };

export function verifyCoachBridge(payload: string, signature: string, secret: string): CoachIdentity | null {
  if (!payload || !secret || !/^[a-f0-9]{64}$/i.test(signature)) return null;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const suppliedBuffer = Buffer.from(signature.toLowerCase(), "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (suppliedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)) return null;

  try {
    const parsed = JSON.parse(payload) as { id?: unknown; name?: unknown; role?: unknown };
    if (
      typeof parsed.id === "string" && parsed.id.trim() &&
      typeof parsed.name === "string" && parsed.name.trim() &&
      (parsed.role === "head_coach" || parsed.role === "assistant_coach")
    ) {
      return { id: parsed.id, name: parsed.name, role: parsed.role };
    }
  } catch {
    return null;
  }
  return null;
}
