import { DevelopmentServiceError } from "@/lib/services/development";
import {
  getMobileMatchEvaluation,
  saveMobileMatchEvaluation,
  type MobileMatchEvaluationAnswer,
} from "@/lib/services/matchEvaluationMobile";
import { mobileError, mobileResponse, requireMobileActor } from "@/lib/mobileApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function matchId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new DevelopmentServiceError("invalid", "Ogiltigt match-id.", 400);
  return id;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireMobileActor(request);
    return mobileResponse(await getMobileMatchEvaluation(actor, matchId((await context.params).id)));
  } catch (error) {
    return mobileError(error);
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireMobileActor(request);
    const body = await request.json() as { answers?: MobileMatchEvaluationAnswer[] };
    if (!Array.isArray(body.answers) || body.answers.length > 50) {
      throw new DevelopmentServiceError("invalid", "Ogiltigt utvärderingsunderlag.", 400);
    }
    return mobileResponse(await saveMobileMatchEvaluation(actor, matchId((await context.params).id), body.answers));
  } catch (error) {
    return mobileError(error);
  }
}
