import { DevelopmentServiceError, createMobileDevelopmentGoal } from "@/lib/services/development";
import { mobileError, mobileResponse, requireMobileActor } from "@/lib/mobileApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireMobileActor(request);
    const { id } = await context.params;
    const playerId = Number(id);
    if (!Number.isInteger(playerId)) throw new DevelopmentServiceError("invalid", "Ogiltigt spelar-id.", 400);
    const body = await request.json() as { title?: string; evidenceHint?: string; reviewOn?: string | null };
    return mobileResponse(await createMobileDevelopmentGoal(actor, playerId, {
      title: String(body.title ?? ""),
      evidenceHint: String(body.evidenceHint ?? ""),
      reviewOn: body.reviewOn == null ? null : String(body.reviewOn),
    }));
  } catch (error) {
    return mobileError(error);
  }
}
