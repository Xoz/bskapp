import "server-only";

import { batch, all, get, logActivity, type SqlArgs } from "../db";
import type { CurrentUser } from "../auth";
import { getMatchEvaluationWorkspace } from "../matchEvaluation";
import { DevelopmentServiceError } from "./development";

const SELF_VALUES = new Set(["below", "usual", "above"]);
const IMPACT_VALUES = new Set(["struggled", "held", "influenced"]);
const REASON_VALUES = new Set(["", "decisions", "defence", "attack", "effort", "confidence"]);

export type MobileMatchEvaluationSummary = {
  id: number;
  opponent: string;
  date: string;
  startTime: string | null;
  level: string;
  homeAway: string;
  total: number;
  handled: number;
};

export type MobileMatchEvaluationWorkspace = {
  match: Omit<MobileMatchEvaluationSummary, "total" | "handled"> & { activityId: string | null };
  players: {
    id: number;
    name: string;
    jerseyNumber: number | null;
    level: string;
    selfComparison: string | null;
    matchImpact: string | null;
    reasonTag: string;
    skipped: boolean;
  }[];
};

export type MobileMatchEvaluationAnswer = {
  playerId: number;
  selfComparison: string | null;
  matchImpact: string | null;
  reasonTag: string;
  skipped: boolean;
};

function requireEvaluationPermission(actor: CurrentUser): void {
  if (!actor.permissions.includes("manage_evaluations")) {
    throw new DevelopmentServiceError("forbidden", "Behörighet saknas.", 403);
  }
}

function groupScope(actor: CurrentUser, alias = "m"): { sql: string; args: SqlArgs } {
  if (actor.roles.includes("admin") || actor.groupIds.length === 0) return { sql: "1 = 1", args: [] };
  const marks = actor.groupIds.map(() => "?").join(", ");
  return {
    sql: `EXISTS (SELECT 1 FROM groups scope_g WHERE scope_g.id = ${alias}.group_id AND (scope_g.id IN (${marks}) OR scope_g.parent_id IN (${marks})))`,
    args: [...actor.groupIds, ...actor.groupIds],
  };
}

export async function getMobileMatchEvaluation(
  actor: CurrentUser,
  matchId: number
): Promise<MobileMatchEvaluationWorkspace> {
  requireEvaluationPermission(actor);
  if (!Number.isInteger(matchId) || matchId < 1) throw new DevelopmentServiceError("invalid", "Ogiltigt match-id.", 400);
  const scope = groupScope(actor);
  const accessible = await get<{ id: number }>(`SELECT m.id FROM matches m WHERE m.id = ? AND ${scope.sql}`, [matchId, ...scope.args]);
  if (!accessible) throw new DevelopmentServiceError("not_found", "Matchen hittades inte.", 404);
  const workspace = await getMatchEvaluationWorkspace(matchId, "coach", String(actor.id));
  if (!workspace) throw new DevelopmentServiceError("not_found", "Matchutvärderingen hittades inte.", 404);
  return {
    match: {
      id: workspace.match.id,
      opponent: workspace.match.opponent,
      date: workspace.match.date,
      startTime: workspace.match.start_time,
      level: workspace.match.level,
      homeAway: workspace.match.home_away,
      activityId: workspace.match.activity_id,
    },
    players: workspace.players.map((player) => ({
      id: player.id,
      name: player.name,
      jerseyNumber: player.jersey_number,
      level: player.level,
      selfComparison: player.self_comparison,
      matchImpact: player.match_impact,
      reasonTag: player.reason_tag,
      skipped: Boolean(player.skipped),
    })),
  };
}

export async function listMobileMatchEvaluations(actor: CurrentUser): Promise<MobileMatchEvaluationSummary[]> {
  requireEvaluationPermission(actor);
  const scope = groupScope(actor);
  const matches = await all<{
    id: number;
    opponent: string;
    date: string;
    start_time: string | null;
    level: string;
    home_away: string;
  }>(
    `SELECT m.id, m.opponent, m.date, m.start_time, m.level, m.home_away
     FROM matches m
     WHERE m.date BETWEEN to_char((now() AT TIME ZONE 'Europe/Stockholm')::date - 7, 'YYYY-MM-DD')
                      AND to_char((now() AT TIME ZONE 'Europe/Stockholm')::date + 1, 'YYYY-MM-DD')
       AND m.finished = 1
       AND EXISTS (
         SELECT 1
         FROM development_activities da
         JOIN groups g ON g.id = da.group_id
         WHERE da.match_id = m.id
           AND g.group_type = 'subgroup'
           AND lower(trim(g.name)) = 'gul'
           AND da.external_source IN ('svenskalag_sanktan', 'manual', 'manual_match')
       )
       AND ${scope.sql}
     ORDER BY m.date DESC, m.start_time DESC NULLS LAST, m.id DESC
     LIMIT 20`,
    scope.args
  );
  return Promise.all(matches.map(async (match) => {
    const workspace = await getMobileMatchEvaluation(actor, match.id);
    const handled = workspace.players.filter((player) => player.skipped || (player.selfComparison && player.matchImpact)).length;
    return {
      id: match.id,
      opponent: match.opponent,
      date: match.date,
      startTime: match.start_time,
      level: match.level,
      homeAway: match.home_away,
      total: workspace.players.length,
      handled,
    };
  }));
}

export async function saveMobileMatchEvaluation(
  actor: CurrentUser,
  matchId: number,
  answers: MobileMatchEvaluationAnswer[]
): Promise<MobileMatchEvaluationWorkspace> {
  const workspace = await getMobileMatchEvaluation(actor, matchId);
  const byPlayer = new Map(workspace.players.map((player) => [player.id, player]));
  const seen = new Set<number>();
  const statements: { sql: string; args: SqlArgs }[] = [];
  for (const answer of answers) {
    const player = byPlayer.get(answer.playerId);
    if (!player || seen.has(answer.playerId)) throw new DevelopmentServiceError("invalid", "Ogiltigt spelarunderlag.", 400);
    seen.add(answer.playerId);
    if (!answer.skipped && (!answer.selfComparison || !answer.matchImpact)) continue;
    if (
      (!answer.skipped && (!SELF_VALUES.has(answer.selfComparison!) || !IMPACT_VALUES.has(answer.matchImpact!)))
      || !REASON_VALUES.has(answer.reasonTag)
    ) throw new DevelopmentServiceError("invalid", "Ogiltig matchbedömning.", 400);
    statements.push({
      sql: `INSERT INTO match_player_evaluations
              (match_id, player_id, contributor_type, contributor_id, self_comparison, match_impact, reason_tag, player_level_snapshot, match_level_snapshot, skipped)
            VALUES (?, ?, 'coach', ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(match_id, player_id, contributor_type, contributor_id) DO UPDATE SET
              self_comparison = excluded.self_comparison, match_impact = excluded.match_impact,
              reason_tag = excluded.reason_tag, player_level_snapshot = excluded.player_level_snapshot,
              match_level_snapshot = excluded.match_level_snapshot, skipped = excluded.skipped, updated_at = now()`,
      args: [
        matchId,
        player.id,
        String(actor.id),
        answer.skipped ? null : answer.selfComparison,
        answer.skipped ? null : answer.matchImpact,
        answer.skipped ? "" : answer.reasonTag,
        player.level,
        workspace.match.level,
        answer.skipped ? 1 : 0,
      ],
    });
  }
  if (statements.length) {
    await batch(statements);
    await logActivity(actor.name, "utvärderade match native", `${statements.length} spelare`);
  }
  return getMobileMatchEvaluation(actor, matchId);
}
