import { getCurrentUser } from "@/lib/auth";
import { signCoachBridge, type CoachBridgeRole } from "@/lib/coachBridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  const role: CoachBridgeRole | null = user?.roles.includes("admin") || user?.roles.includes("head_coach")
    ? "head_coach"
    : user?.roles.includes("coach")
      ? "assistant_coach"
      : null;
  if (!user || !role) return new Response(null, { status: 401, headers: { "cache-control": "no-store" } });
  const secret = process.env.BSK_SESSION_BRIDGE_SECRET;
  if (!secret) return new Response(null, { status: 503, headers: { "cache-control": "no-store" } });
  const signed = signCoachBridge({ id: String(user.id), name: user.name || user.email, role }, secret);
  return new Response(null, {
    status: 204,
    headers: {
      "x-bsk-coach": signed.payload,
      "x-bsk-coach-signature": signed.signature,
      "cache-control": "no-store",
    },
  });
}
