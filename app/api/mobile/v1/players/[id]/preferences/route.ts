import { DevelopmentServiceError, updateMobilePlayerPreferences } from "@/lib/services/development";
import { mobileError, mobileResponse, requireMobileActor } from "@/lib/mobileApi";
import { isValidChallengeLevel } from "@/lib/playerLevelPreferences";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireMobileActor(request);
    const { id } = await context.params;
    const playerId = Number(id);
    if (!Number.isInteger(playerId)) throw new DevelopmentServiceError("invalid", "Ogiltigt spelar-id.", 400);
    const body = await request.json() as Record<string, unknown>;
    const primaryLevel = String(body.primaryLevel ?? "");
    const secondaryLevel = String(body.secondaryLevel ?? "");
    if (!isValidChallengeLevel(primaryLevel, secondaryLevel)) {
      throw new DevelopmentServiceError("invalid", "Utmaningsnivån måste vara svårare än normalnivån.", 400);
    }
    return mobileResponse(await updateMobilePlayerPreferences(actor, playerId, {
      primaryPosition: String(body.primaryPosition ?? ""),
      secondaryPosition: String(body.secondaryPosition ?? ""),
      primaryLevel,
      secondaryLevel,
      selectionEligible: body.selectionEligible === true,
    }));
  } catch (error) {
    return mobileError(error);
  }
}
