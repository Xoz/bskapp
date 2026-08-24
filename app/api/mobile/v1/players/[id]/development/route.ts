import {
  DevelopmentServiceError,
  getMobilePlayerDevelopment,
  updateMobilePlayerDevelopment,
  type UpdateMobilePlayerDevelopmentInput,
} from "@/lib/services/development";
import { mobileError, mobileResponse, requireMobileActor } from "@/lib/mobileApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireMobileActor(request);
    const { id } = await context.params;
    return mobileResponse(await getMobilePlayerDevelopment(actor, Number(id)));
  } catch (error) {
    return mobileError(error);
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireMobileActor(request);
    const { id } = await context.params;
    const body = await request.json().catch(() => {
      throw new DevelopmentServiceError("invalid", "Ogiltigt JSON-underlag.", 400);
    }) as UpdateMobilePlayerDevelopmentInput;
    return mobileResponse(await updateMobilePlayerDevelopment(actor, Number(id), body));
  } catch (error) {
    return mobileError(error);
  }
}
