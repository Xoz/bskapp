import { DevelopmentServiceError, updateMobilePlayerPreferences } from "@/lib/services/development";
import { mobileError, mobileResponse, requireMobileActor } from "@/lib/mobileApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireMobileActor(request);
    const { id } = await context.params;
    const playerId = Number(id);
    if (!Number.isInteger(playerId)) throw new DevelopmentServiceError("invalid", "Ogiltigt spelar-id.", 400);
    const body = await request.json() as Record<string, unknown>;
    return mobileResponse(await updateMobilePlayerPreferences(actor, playerId, {
      primaryPosition: String(body.primaryPosition ?? ""),
      secondaryPosition: String(body.secondaryPosition ?? ""),
      primaryLevel: String(body.primaryLevel ?? ""),
      secondaryLevel: String(body.secondaryLevel ?? ""),
      selectionEligible: body.selectionEligible === true,
    }));
  } catch (error) {
    return mobileError(error);
  }
}
