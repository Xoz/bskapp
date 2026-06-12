import { NextRequest, NextResponse } from "next/server";
import {
  getMatchRowByCode,
  getLiveState,
  recordEvent,
  undoLastEvent,
  setClock,
  togglePlayed,
} from "@/lib/live";
import { OPPONENT_GOAL, LiveAction } from "@/lib/liveTypes";

export const dynamic = "force-dynamic";

function matchFromCode(code: string) {
  const clean = code.replace(/\D/g, "");
  if (clean.length !== 6) return undefined;
  return getMatchRowByCode(clean);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const match = matchFromCode(code);
  if (!match) return NextResponse.json({ error: "Ogiltig kod" }, { status: 404 });
  return NextResponse.json(getLiveState(match.id));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const match = matchFromCode(code);
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
        recordEvent(match.id, action.playerId, action.statId);
        break;
      case "opponent_goal":
        recordEvent(match.id, null, OPPONENT_GOAL);
        break;
      case "undo":
        undoLastEvent(match.id);
        break;
      case "clock":
        setClock(match.id, action.op);
        break;
      case "toggle_played":
        togglePlayed(match.id, action.playerId);
        break;
      default:
        return NextResponse.json({ error: "Okänd åtgärd" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Kunde inte spara" }, { status: 500 });
  }

  return NextResponse.json(getLiveState(match.id));
}
