import { NextRequest, NextResponse } from "next/server";
import {
  getMatchRowByCode,
  getLiveState,
  recordEvent,
  undoLastEvent,
  setClock,
  togglePlayed,
  claimStats,
  finishMatch,
  recordSub,
  undoLastSub,
} from "@/lib/live";
import { OPPONENT_GOAL, LiveAction } from "@/lib/liveTypes";

export const dynamic = "force-dynamic";

async function matchFromCode(code: string) {
  const clean = code.replace(/\D/g, "");
  if (clean.length !== 6) return undefined;
  return getMatchRowByCode(clean);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const match = await matchFromCode(code);
  if (!match) return NextResponse.json({ error: "Ogiltig kod" }, { status: 404 });
  return NextResponse.json(await getLiveState(match.id));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const match = await matchFromCode(code);
  if (!match) return NextResponse.json({ error: "Ogiltig kod" }, { status: 404 });

  let action: LiveAction;
  try {
    action = (await req.json()) as LiveAction;
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }

  try {
    switch (action.type) {
      case "event":
        await recordEvent(match.id, action.playerId, action.statId, action.reporter ?? null);
        break;
      case "opponent_goal":
        await recordEvent(match.id, null, OPPONENT_GOAL);
        break;
      case "undo":
        await undoLastEvent(match.id);
        break;
      case "clock":
        await setClock(match.id, action.op);
        break;
      case "toggle_played":
        await togglePlayed(match.id, action.playerId);
        break;
      case "claim_stats":
        await claimStats(match.id, action.name, action.stats);
        break;
      case "sub":
        await recordSub(match.id, action.offId, action.onId);
        break;
      case "undo_sub":
        await undoLastSub(match.id);
        break;
      case "finish_match":
        await finishMatch(match.id);
        break;
      default:
        return NextResponse.json({ error: "Okänd åtgärd" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Kunde inte spara" }, { status: 500 });
  }

  return NextResponse.json(await getLiveState(match.id));
}
