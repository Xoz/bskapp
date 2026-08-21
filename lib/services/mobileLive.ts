import { type CurrentUser } from "@/lib/auth";
import { get } from "@/lib/db";
import { getLiveState, recordEvent, setClock, undoLastEvent } from "@/lib/live";
import { OPPONENT_GOAL } from "@/lib/liveTypes";
import { DevelopmentServiceError } from "@/lib/services/development";

export type MobileLiveAction =
  | { type: "clock"; op: "start" | "pause" | "reset" | "next_period" }
  | { type: "goal"; playerId: number; idempotencyKey: string }
  | { type: "opponent_goal"; idempotencyKey: string }
  | { type: "undo" };

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

export async function getMobileLiveMatch(actor: CurrentUser, matchId: number) {
  await requireAccessibleMatch(actor, matchId);
  return getLiveState(matchId, true);
}

export async function updateMobileLiveMatch(actor: CurrentUser, matchId: number, action: MobileLiveAction) {
  await requireAccessibleMatch(actor, matchId);
  if (action.type === "clock") {
    await setClock(matchId, action.op);
  } else if (action.type === "goal") {
    const state = await getLiveState(matchId, true);
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
  return getLiveState(matchId, true);
}
