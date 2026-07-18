import crypto from "crypto";
import { headers } from "next/headers";

export type CoachIdentity = { id: string; name: string; role: "head_coach" | "assistant_coach" };

// Nginx/BSK måste sätta båda headers och ta bort klientens varianter. Signaturen
// gör att plattformen aldrig litar på en roll eller användare från webbläsaren.
export async function requireCoachIdentity(): Promise<CoachIdentity> {
  const h = await headers();
  const payload = h.get("x-bsk-coach");
  const signature = h.get("x-bsk-coach-signature");
  const secret = process.env.BSK_SESSION_BRIDGE_SECRET;
  if (payload && signature && secret) {
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      const parsed = JSON.parse(payload) as { id?: string; name?: string; role?: string };
      if (parsed.id && parsed.name && (parsed.role === "head_coach" || parsed.role === "assistant_coach"))
        return { id: parsed.id, name: parsed.name, role: parsed.role };
    }
  }
  if (process.env.NODE_ENV !== "production") return { id: "local-demo-coach", name: "Demo Tränare", role: "head_coach" };
  throw new Error("Tränarbehörighet saknas. BSK-sessionen kunde inte verifieras.");
}
