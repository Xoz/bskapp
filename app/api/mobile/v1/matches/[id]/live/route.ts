import { DevelopmentServiceError } from "@/lib/services/development";
import { getMobileLiveMatch, updateMobileLiveMatch, type MobileLiveAction } from "@/lib/services/mobileLive";
import { mobileError, mobileResponse, requireMobileActor } from "@/lib/mobileApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseMatchId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new DevelopmentServiceError("invalid", "Ogiltigt match-id.", 400);
  return id;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireMobileActor(request);
    return mobileResponse(await getMobileLiveMatch(actor, parseMatchId((await context.params).id)));
  } catch (error) {
    return mobileError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireMobileActor(request);
    const action = await request.json() as MobileLiveAction;
    if (!action || typeof action.type !== "string") {
      throw new DevelopmentServiceError("invalid", "Matchåtgärd saknas.", 400);
    }
    return mobileResponse(await updateMobileLiveMatch(actor, parseMatchId((await context.params).id), action));
  } catch (error) {
    return mobileError(error);
  }
}
