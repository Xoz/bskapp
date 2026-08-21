import { type CurrentUser } from "../auth";
import { all, get } from "../db";
import { getLiveState, recordEvent, setClock, undoLastEvent } from "../live";
import { OPPONENT_GOAL } from "../liveTypes";
import { DevelopmentServiceError } from "./development";

export type MobileLiveAction =
  | { type: "clock"; op: "start" | "pause" | "reset" | "next_period" }
  | { type: "goal"; playerId: number; idempotencyKey: string }
  | { type: "opponent_goal"; idempotencyKey: string }
  | { type: "undo" };

const IDEMPOTENCY_KEY = /^[a-zA-Z0-9_-]{8,80}$/;
const CLOCK_OPERATIONS = new Set(["start", "pause", "reset", "next_period"]);

export function parseMobileLiveAction(input: unknown): MobileLiveAction {
  if (!input || typeof input !== "object") {
    throw new DevelopmentServiceError("invalid", "Matchåtgärd saknas.", 400);
  }
  const action = input as Record<string, unknown>;
  if (action.type === "clock") {
    if (typeof action.op !== "string" || !CLOCK_OPERATIONS.has(action.op)) {
      throw new DevelopmentServiceError("invalid", "Ogiltig klockåtgärd.", 400);
    }
    return { type: "clock", op: action.op as "start" | "pause" | "reset" | "next_period" };
  }
  if (action.type === "goal") {
    if (!Number.isInteger(action.playerId) || Number(action.playerId) < 1) {
      throw new DevelopmentServiceError("invalid", "Ogiltig målskytt.", 400);
    }
    if (typeof action.idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(action.idempotencyKey)) {
      throw new DevelopmentServiceError("invalid", "Ogiltig idempotensnyckel.", 400);
    }
    return { type: "goal", playerId: Number(action.playerId), idempotencyKey: action.idempotencyKey };
  }
  if (action.type === "opponent_goal") {
    if (typeof action.idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(action.idempotencyKey)) {
      throw new DevelopmentServiceError("invalid", "Ogiltig idempotensnyckel.", 400);
    }
    return { type: "opponent_goal", idempotencyKey: action.idempotencyKey };
  }
  if (action.type === "undo") return { type: "undo" };
  throw new DevelopmentServiceError("invalid", "Okänd matchåtgärd.", 400);
}

function requireReporting(actor: CurrentUser) {
  if (!actor.permissions.includes("report_matches")) {
    throw new DevelopmentServiceError("forbidden", "Du saknar behörighet att rapportera matchen.", 403);
  }
}

async function requireAccessibleMatch(actor: CurrentUser, matchId: number) {
  requireReporting(actor);
  if (!Number.isInteger(matchId) || matchId < 1) {
    throw new DevelopmentServiceError("invalid", "Ogiltigt match-id.", 400);
  }
  const unrestricted = actor.roles.includes("admin") || actor.groupIds.length === 0;
  const marks = actor.groupIds.map(() => "?").join(", ");
  const row = await get<{ id: number }>(
    `SELECT m.id FROM matches m
     WHERE m.id = ?
       ${unrestricted ? "" : `AND EXISTS (
         SELECT 1 FROM groups g
         WHERE g.id = m.group_id
           AND (g.id IN (${marks}) OR g.parent_id IN (${marks}))
       )`}`,
    unrestricted ? [matchId] : [matchId, ...actor.groupIds, ...actor.groupIds]
  );
  if (!row) throw new DevelopmentServiceError("not_found", "Matchen hittades inte.", 404);
}

async function getMobileLiveState(matchId: number) {
  const state = await getLiveState(matchId, true);
  const squad = (await all<{ player_id: number }>(
    "SELECT player_id FROM match_squad WHERE match_id = ?",
    [matchId]
  )).map((row) => row.player_id);
  const allowed = new Set(squad);

  return {
    ...state,
    players: state.players.filter((player) => allowed.has(player.id)),
    onField: state.onField.filter((playerId) => allowed.has(playerId)),
  };
}

export async function getMobileLiveMatch(actor: CurrentUser, matchId: number) {
  await requireAccessibleMatch(actor, matchId);
  return getMobileLiveState(matchId);
}

export async function updateMobileLiveMatch(actor: CurrentUser, matchId: number, action: MobileLiveAction) {
  await requireAccessibleMatch(actor, matchId);
  if (action.type === "clock") {
    await setClock(matchId, action.op);
  } else if (action.type === "goal") {
    const state = await getMobileLiveState(matchId);
    if (!Number.isInteger(action.playerId) || !state.players.some((player) => player.id === action.playerId)) {
      throw new DevelopmentServiceError("invalid", "Målskytten ingår inte i matchtruppen.", 400);
    }
    await recordEvent(matchId, action.playerId, "goals", actor.name, `mobile-${actor.id}`, action.idempotencyKey);
  } else if (action.type === "opponent_goal") {
    await recordEvent(matchId, null, OPPONENT_GOAL, actor.name, `mobile-${actor.id}`, action.idempotencyKey);
  } else if (action.type === "undo") {
    await undoLastEvent(matchId, null, true);
  } else {
    throw new DevelopmentServiceError("invalid", "Okänd matchåtgärd.", 400);
  }
  return getMobileLiveState(matchId);
}
