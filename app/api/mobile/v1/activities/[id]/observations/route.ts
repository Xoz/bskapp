import { createDevelopmentObservations, type CreateObservationCommand } from "@/lib/services/development";
import { mobileError, mobileResponse, requireMobileActor } from "@/lib/mobileApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireMobileActor(request);
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 32_768) throw new Error("request_too_large");
    const body = await request.json() as { commands?: CreateObservationCommand[] };
    const { id } = await context.params;
    const commands = Array.isArray(body.commands) ? body.commands : [];
    return mobileResponse(await createDevelopmentObservations(actor, id, commands));
  } catch (error) {
    return mobileError(error);
  }
}
