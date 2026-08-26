import {
  createMobilePlayerConversation,
  DevelopmentServiceError,
} from "@/lib/services/development";
import { mobileError, mobileResponse, requireMobileActor } from "@/lib/mobileApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireMobileActor(request);
    const { id } = await context.params;
    const playerId = Number(id);
    if (!Number.isInteger(playerId)) {
      throw new DevelopmentServiceError("invalid", "Ogiltigt spelar-id.", 400);
    }
    const body = await request.json().catch(() => {
      throw new DevelopmentServiceError("invalid", "Ogiltigt JSON-underlag.", 400);
    }) as {
      date?: string;
      coachSummary?: string;
      playerPerspective?: string;
      agreedActions?: string;
      followUpOn?: string | null;
    };
    return mobileResponse(await createMobilePlayerConversation(actor, playerId, {
      date: String(body.date ?? ""),
      coachSummary: String(body.coachSummary ?? ""),
      playerPerspective: String(body.playerPerspective ?? ""),
      agreedActions: String(body.agreedActions ?? ""),
      followUpOn: body.followUpOn == null ? null : String(body.followUpOn),
    }));
  } catch (error) {
    return mobileError(error);
  }
}
