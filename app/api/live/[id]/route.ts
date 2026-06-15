import { NextRequest, NextResponse } from "next/server";
import { getRole } from "@/lib/auth";
import { get } from "@/lib/db";
import {
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

// Läsning (Livescore) är publik. Skrivning kräver tränare, ELLER att tränaren
// öppnat rapportering för matchen (report_open) – då får föräldrar/hjälpare logga.
async function matchFromId(id: string) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return get<{ id: number; report_open: number }>(
    "SELECT id, report_open FROM matches WHERE id = ?",
    [n]
  );
}

// Att avsluta matchen stänger rapporteringen för alla – förbehålls tränaren.
const COACH_ONLY_ACTIONS = new Set<LiveAction["type"]>(["finish_match"]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const match = await matchFromId(id);
  if (!match) return NextResponse.json({ error: "Matchen finns inte" }, { status: 404 });
  return NextResponse.json(await getLiveState(match.id));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const match = await matchFromId(id);
  if (!match) return NextResponse.json({ error: "Matchen finns inte" }, { status: 404 });

  let action: LiveAction;
  try {
    action = (await req.json()) as LiveAction;
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }

  const isCoach = (await getRole()) === "coach";
  // finish_match: bara tränare. Övriga skrivningar: tränare eller öppen rapportering.
  if (!isCoach && (COACH_ONLY_ACTIONS.has(action.type) || !match.report_open)) {
    return NextResponse.json({ error: "Rapportering ej öppen" }, { status: 401 });
  }

  try {
    switch (action.type) {
      case "event":
        await recordEvent(match.id, action.playerId, action.statId, action.reporter ?? null);
        break;
      case "opponent_goal":
        await recordEvent(match.id, null, OPPONENT_GOAL, action.reporter ?? null);
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
