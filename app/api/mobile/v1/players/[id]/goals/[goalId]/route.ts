import { DevelopmentServiceError, closeMobileDevelopmentGoal } from "@/lib/services/development";
import { mobileError, mobileResponse, requireMobileActor } from "@/lib/mobileApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string; goalId: string }> }) {
  try {
    const actor = await requireMobileActor(request);
    const { id, goalId } = await context.params;
    const playerId = Number(id);
    if (!Number.isInteger(playerId)) throw new DevelopmentServiceError("invalid", "Ogiltigt spelar-id.", 400);
    const body = await request.json() as { status?: string };
    if (body.status !== "achieved" && body.status !== "paused") {
      throw new DevelopmentServiceError("invalid", "Ogiltig målstatus.", 400);
    }
    return mobileResponse(await closeMobileDevelopmentGoal(actor, playerId, goalId, body.status));
  } catch (error) {
    return mobileError(error);
  }
}
