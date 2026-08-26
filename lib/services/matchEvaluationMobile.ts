import "server-only";

import { batch, all, get, logActivity, type SqlArgs } from "../db";
import type { CurrentUser } from "../auth";
import { getMatchEvaluationWorkspace } from "../matchEvaluation";
import { shouldCloseMatchFollowup } from "../matchFollowup";
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
  match: Omit<MobileMatchEvaluationSummary, "total" | "handled"> & {
    activityId: string | null;
    ourScore: number | null;
    opponentScore: number | null;
    hasLiveData: boolean;
    coachComment: string;
  };
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

export type MobileMatchEvaluationContext = {
  ourScore: number | null;
  opponentScore: number | null;
  coachComment: string;
  completeWithoutPlayerEvaluations?: boolean;
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
  const accessible = await get<{
    id: number;
    our_score: number | null;
    opponent_score: number | null;
    evaluation_comment: string;
    has_live_data: boolean;
  }>(`SELECT m.id, m.our_score, m.opponent_score, COALESCE(m.evaluation_comment, '') AS evaluation_comment,
             (m.clock_offset > 0 OR m.clock_started_at IS NOT NULL OR EXISTS (
               SELECT 1 FROM match_events event WHERE event.match_id = m.id
             )) AS has_live_data
      FROM matches m WHERE m.id = ? AND ${scope.sql}`, [matchId, ...scope.args]);
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
      ourScore: accessible.our_score,
      opponentScore: accessible.opponent_score,
      hasLiveData: accessible.has_live_data,
      coachComment: accessible.evaluation_comment,
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
       AND (
         m.finished = 1
         OR m.date < to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD')
         OR (
           m.start_time IS NOT NULL
           AND m.date::date + m.start_time::time + INTERVAL '90 minutes'
                <= now() AT TIME ZONE 'Europe/Stockholm'
         )
       )
       AND m.evaluation_closed_at IS NULL
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
  const summaries = await Promise.all(matches.map(async (match) => {
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
  return summaries.filter((match) => match.total === 0 || match.handled < match.total);
}

export async function saveMobileMatchEvaluation(
  actor: CurrentUser,
  matchId: number,
  answers: MobileMatchEvaluationAnswer[],
  context?: MobileMatchEvaluationContext
): Promise<MobileMatchEvaluationWorkspace> {
  const workspace = await getMobileMatchEvaluation(actor, matchId);
  const evaluationContext = context ?? {
    ourScore: workspace.match.ourScore,
    opponentScore: workspace.match.opponentScore,
    coachComment: workspace.match.coachComment,
  };
  const coachComment = evaluationContext.coachComment.trim();
  if (coachComment.length > 4000) throw new DevelopmentServiceError("invalid", "Tränarkommentaren är för lång.", 400);
  const scores = [evaluationContext.ourScore, evaluationContext.opponentScore];
  if (scores.some((score) => score !== null && (!Number.isInteger(score) || score < 0 || score > 99))) {
    throw new DevelopmentServiceError("invalid", "Ogiltigt slutresultat.", 400);
  }
  if ((evaluationContext.ourScore === null) !== (evaluationContext.opponentScore === null)) {
    throw new DevelopmentServiceError("invalid", "Fyll i båda resultatfälten.", 400);
  }
  if (workspace.match.hasLiveData && (evaluationContext.ourScore !== workspace.match.ourScore || evaluationContext.opponentScore !== workspace.match.opponentScore)) {
    throw new DevelopmentServiceError("idempotency_conflict", "Resultatet kommer från Matchcenter och kan inte ändras här.", 409);
  }
  const byPlayer = new Map(workspace.players.map((player) => [player.id, player]));
  const seen = new Set<number>();
  const acceptedAnswers: MobileMatchEvaluationAnswer[] = [];
  const statements: { sql: string; args: SqlArgs }[] = [];
  statements.push({
    sql: workspace.match.hasLiveData
      ? `UPDATE matches SET evaluation_comment = ?, evaluation_updated_by = ?, evaluation_updated_at = now() WHERE id = ?`
      : `UPDATE matches SET our_score = ?, opponent_score = ?, evaluation_comment = ?, evaluation_updated_by = ?, evaluation_updated_at = now() WHERE id = ?`,
    args: workspace.match.hasLiveData
      ? [coachComment, actor.id, matchId]
      : [evaluationContext.ourScore, evaluationContext.opponentScore, coachComment, actor.id, matchId],
  });
  for (const answer of answers) {
    const player = byPlayer.get(answer.playerId);
    if (!player || seen.has(answer.playerId)) throw new DevelopmentServiceError("invalid", "Ogiltigt spelarunderlag.", 400);
    seen.add(answer.playerId);
    const hasPartialAssessment = !answer.skipped && Boolean(answer.selfComparison || answer.matchImpact);
    if (hasPartialAssessment && (!answer.selfComparison || !answer.matchImpact)) {
      if (evaluationContext.completeWithoutPlayerEvaluations === true) continue;
      throw new DevelopmentServiceError("invalid", "Fyll i båda bedömningarna för spelaren.", 400);
    }
    if (!answer.skipped && (!answer.selfComparison || !answer.matchImpact)) continue;
    if (
      (!answer.skipped && (!SELF_VALUES.has(answer.selfComparison!) || !IMPACT_VALUES.has(answer.matchImpact!)))
      || !REASON_VALUES.has(answer.reasonTag)
    ) throw new DevelopmentServiceError("invalid", "Ogiltig matchbedömning.", 400);
    acceptedAnswers.push(answer);
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
  const closeFollowup = shouldCloseMatchFollowup(
    workspace.players.map((player) => player.id),
    workspace.players.map((player) => ({
      playerId: player.id,
      selfComparison: player.selfComparison,
      matchImpact: player.matchImpact,
      skipped: player.skipped,
    })),
    acceptedAnswers,
    evaluationContext.completeWithoutPlayerEvaluations === true
  );
  if (closeFollowup) {
    statements.push({
      sql: `UPDATE matches SET evaluation_closed_at = COALESCE(evaluation_closed_at, now()),
                               evaluation_players_waived = ?
            WHERE id = ?`,
      args: [evaluationContext.completeWithoutPlayerEvaluations === true ? 1 : 0, matchId],
    });
  }
  await batch(statements);
  await logActivity(
    actor.name,
    evaluationContext.completeWithoutPlayerEvaluations === true
      ? "avslutade matchuppföljning utan spelarbedömningar"
      : "utvärderade match native",
    `${acceptedAnswers.length} spelare`
  );
  return getMobileMatchEvaluation(actor, matchId);
}
