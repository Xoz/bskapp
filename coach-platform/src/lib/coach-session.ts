import { headers } from "next/headers";
import { verifyCoachBridge, type CoachIdentity } from "./bridge-auth";

export type { CoachIdentity } from "./bridge-auth";

// Nginx/BSK måste sätta båda headers och ta bort klientens varianter. Signaturen
// gör att plattformen aldrig litar på en roll eller användare från webbläsaren.
export async function requireCoachIdentity(): Promise<CoachIdentity> {
  const h = await headers();
  const payload = h.get("x-bsk-coach");
  const signature = h.get("x-bsk-coach-signature");
  const secret = process.env.BSK_SESSION_BRIDGE_SECRET;
  if (payload && signature && secret) {
    const identity = verifyCoachBridge(payload, signature, secret);
    if (identity) return identity;
  }
  if (process.env.NODE_ENV !== "production") return { id: "local-demo-coach", name: "Demo Tränare", role: "head_coach" };
  throw new Error("Tränarbehörighet saknas. BSK-sessionen kunde inte verifieras.");
}

export async function requireHeadCoachIdentity(): Promise<CoachIdentity> {
  const identity = await requireCoachIdentity();
  if (identity.role !== "head_coach") throw new Error("Åtgärden kräver huvudtränarbehörighet.");
  return identity;
}
