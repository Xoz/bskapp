import { listMobileActivityPlayers } from "@/lib/services/development";
import { mobileError, mobileResponse, requireMobileActor } from "@/lib/mobileApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireMobileActor(request);
    const { id } = await context.params;
    return mobileResponse(await listMobileActivityPlayers(actor, id));
  } catch (error) {
    return mobileError(error);
  }
}
