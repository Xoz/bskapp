import {
  DevelopmentServiceError,
  getMobileSelectionWorkspace,
  saveMobileSelection,
  type MobileSelectionDecision,
} from "@/lib/services/development";
import { mobileError, mobileResponse, requireMobileActor } from "@/lib/mobileApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireMobileActor(request);
    const { id } = await context.params;
    return mobileResponse(await getMobileSelectionWorkspace(actor, id));
  } catch (error) {
    return mobileError(error);
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireMobileActor(request);
    const body = await request.json() as { decisions?: MobileSelectionDecision[] };
    if (!Array.isArray(body.decisions) || body.decisions.length > 100) {
      throw new DevelopmentServiceError("invalid", "Ogiltigt uttagningsunderlag.", 400);
    }
    const { id } = await context.params;
    return mobileResponse(await saveMobileSelection(actor, id, body.decisions));
  } catch (error) {
    return mobileError(error);
  }
}
