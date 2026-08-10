import crypto from "crypto";

export type CoachIdentity = { id: string; name: string; role: "head_coach" | "assistant_coach" };

export function verifyCoachBridge(payload: string, signature: string, secret: string, now = Date.now()): CoachIdentity | null {
  if (!payload || payload.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(payload) || !secret || !/^[a-f0-9]{64}$/i.test(signature)) return null;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const suppliedBuffer = Buffer.from(signature.toLowerCase(), "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (suppliedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { id?: unknown; name?: unknown; role?: unknown; issuedAt?: unknown };
    if (
      typeof parsed.id === "string" && parsed.id.trim() &&
      typeof parsed.name === "string" && parsed.name.trim() &&
      typeof parsed.issuedAt === "number" && Number.isFinite(parsed.issuedAt) &&
      parsed.issuedAt >= now - 90_000 && parsed.issuedAt <= now + 15_000 &&
      (parsed.role === "head_coach" || parsed.role === "assistant_coach")
    ) {
      return { id: parsed.id, name: parsed.name, role: parsed.role };
    }
  } catch {
    return null;
  }
  return null;
}
