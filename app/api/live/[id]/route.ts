import { NextRequest, NextResponse } from "next/server";
import { canAccessGroup, hasPermission } from "@/lib/auth";
import { get } from "@/lib/db";
import { reportingAutoOpen } from "@/lib/dates";
import { hasReportingCapability } from "@/lib/liveAccess";
import { consumePublicReportRate } from "@/lib/liveRateLimit";
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
import { LIVE_COUNT_IDS, STAT_IDS } from "@/lib/stats";

export const dynamic = "force-dynamic";

// Läsning (Livescore) är publik. Skrivning kräver tränare, ELLER att rapporteringen
// är öppen för matchen – antingen manuellt öppnad av tränaren (report_open) eller
// automatiskt 60 min före avspark – då får föräldrar/hjälpare logga.
async function matchFromId(id: string) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return get<{
    id: number;
    report_open: number;
    group_id: number | null;
    date: string;
    start_time: string | null;
    finished: number;
    report_token: string;
  }>(
    "SELECT id, report_open, report_token, group_id, date, start_time, finished FROM matches WHERE id = ?",
    [n]
  );
}

const PUBLIC_REPORTER_ACTIONS = new Set<LiveAction["type"]>([
  "event",
  "opponent_goal",
  "undo",
  "claim_stats",
]);
const REPORTER_ID_PATTERN = /^[a-zA-Z0-9_-]{16,80}$/;
// Klientgenererad idempotensnyckel per mutation (UUID-lik). Valideras när den
// skickas; saknas den körs mutationen som tidigare (bakåtkompatibelt).
const IDEMPOTENCY_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;
const MUTATIONS_WITH_KEY = new Set<LiveAction["type"]>(["event", "opponent_goal", "sub"]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const match = await matchFromId(id);
  if (!match) return NextResponse.json({ error: "Matchen finns inte" }, { status: 404 });

  // Publik livescore får bara ställning och händelseflöde. Trupp, intern
  // statistik, byten och rapportörsnamn lämnas enbart till den öppna
  // rapporteringsvyn eller en behörig tränare.
  const wantsReportingDetails = req.nextUrl.searchParams.get("reporter") === "1";
  let includeReportingDetails = false;
  if (wantsReportingDetails) {
    const reportOpen =
      !match.finished &&
      (!!match.report_open || reportingAutoOpen(match.date, match.start_time));
    const isCoach =
      (await hasPermission("report_matches")) && (await canAccessGroup(match.group_id));
    const hasCapability = hasReportingCapability(req.nextUrl.searchParams.get("token"), match.report_token);
    includeReportingDetails = isCoach || (reportOpen && hasCapability);
    if (!includeReportingDetails) {
      return NextResponse.json({ error: "Rapporteringslänken är ogiltig" }, { status: 401 });
    }
  }
  return NextResponse.json(await getLiveState(match.id, includeReportingDetails));
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

  const isCoach = (await hasPermission("report_matches")) && (await canAccessGroup(match.group_id));
  const reportOpen =
    !match.finished &&
    (!!match.report_open || reportingAutoOpen(match.date, match.start_time));
  const hasCapability = hasReportingCapability(req.nextUrl.searchParams.get("token"), match.report_token);

  if (!isCoach) {
    if (!reportOpen) {
      return NextResponse.json({ error: "Rapportering ej öppen" }, { status: 401 });
    }
    if (!hasCapability) {
      return NextResponse.json({ error: "Rapporteringslänken är ogiltig" }, { status: 401 });
    }
    if (!PUBLIC_REPORTER_ACTIONS.has(action.type)) {
      return NextResponse.json({ error: "Åtgärden kräver tränarbehörighet" }, { status: 403 });
    }
    if (
      (action.type === "event" || action.type === "opponent_goal" || action.type === "undo") &&
      !REPORTER_ID_PATTERN.test(action.reporterId ?? "")
    ) {
      return NextResponse.json({ error: "Rapportör saknas" }, { status: 400 });
    }
    if (action.type === "event" || action.type === "opponent_goal") {
      if (!(await consumePublicReportRate(match.id, action.reporterId!))) {
        return NextResponse.json({ error: "För många händelser – vänta några sekunder" }, { status: 429 });
      }
    }
  }

  try {
    // Validera idempotensnyckel om den skickas (event/opponent_goal/sub).
    const idempotencyKey =
      MUTATIONS_WITH_KEY.has(action.type) && "idempotencyKey" in action
        ? (action.idempotencyKey ?? "")
        : "";
    if (idempotencyKey && !IDEMPOTENCY_PATTERN.test(idempotencyKey)) {
      return NextResponse.json({ error: "Ogiltig idempotensnyckel" }, { status: 400 });
    }
    const idem = idempotencyKey || null;

    switch (action.type) {
      case "event": {
        const allowedStats = isCoach ? LIVE_COUNT_IDS : STAT_IDS;
        if (!Number.isInteger(action.playerId) || !allowedStats.includes(action.statId)) {
          return NextResponse.json({ error: "Ogiltig statistik" }, { status: 400 });
        }
        if (!isCoach) {
          const state = await getLiveState(match.id, true);
          if (!state.players.some((player) => player.id === action.playerId)) {
            return NextResponse.json({ error: "Spelaren ingår inte i matchtruppen" }, { status: 400 });
          }
        }
        await recordEvent(
          match.id,
          action.playerId,
          action.statId,
          action.reporter ?? null,
          action.reporterId ?? null,
          idem
        );
        break;
      }
      case "opponent_goal":
        await recordEvent(
          match.id,
          null,
          OPPONENT_GOAL,
          action.reporter ?? null,
          action.reporterId ?? null,
          idem
        );
        break;
      case "undo":
        await undoLastEvent(match.id, isCoach ? null : action.reporterId!);
        break;
      case "clock":
        await setClock(match.id, action.op);
        break;
      case "toggle_played":
        await togglePlayed(match.id, action.playerId);
        break;
      case "claim_stats": {
        const name = typeof action.name === "string" ? action.name.trim() : "";
        const stats = Array.isArray(action.stats)
          ? [...new Set(action.stats.filter((stat): stat is string => STAT_IDS.includes(stat)))]
          : [];
        if (!name || name.length > 60 || stats.length === 0) {
          return NextResponse.json({ error: "Ogiltiga rapportörsuppgifter" }, { status: 400 });
        }
        await claimStats(match.id, name, stats);
        break;
      }
      case "sub":
        await recordSub(match.id, action.offId, action.onId, idem);
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

  return NextResponse.json(await getLiveState(match.id, true));
}
