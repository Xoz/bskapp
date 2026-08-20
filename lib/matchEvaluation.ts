import crypto from "crypto";
import { all, get } from "./db";
import { canAccessGroup } from "./auth";
import { swedishMinutesSinceMidnight, swedishToday } from "./dates";
import type { MatchImpact, SelfComparison } from "./matchEvaluationTypes";

export const evaluationTokenHash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
export const MATCH_EVALUATION_DELAY_MINUTES = 75;

export function matchEvaluationIsOpen(
  date: string,
  startTime: string | null,
  today = swedishToday(),
  nowMinutes = swedishMinutesSinceMidnight()
): boolean {
  if (date < today) return true;
  if (date > today || !startTime) return false;
  const [hours, minutes] = startTime.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return false;
  return nowMinutes >= hours * 60 + minutes + MATCH_EVALUATION_DELAY_MINUTES;
}

export type MatchEvaluationPlayer = {
  id: number; name: string; jersey_number: number | null; level: string;
  self_comparison: SelfComparison | null; match_impact: MatchImpact | null; reason_tag: string; skipped: number;
};
export type MatchEvaluationWorkspace = {
  match: { id: number; opponent: string; date: string; start_time: string | null; level: string; home_away: string; activity_id: string | null };
  players: MatchEvaluationPlayer[];
};
export async function getMatchEvaluationWorkspace(matchId: number, contributorType: "coach" | "invite", contributorId: string): Promise<MatchEvaluationWorkspace | null> {
  const match = await get<MatchEvaluationWorkspace["match"]>(
    `SELECT m.id, m.opponent, m.date, m.start_time, m.level, m.home_away,
            (SELECT da.id FROM development_activities da WHERE da.match_id = m.id ORDER BY da.id LIMIT 1) AS activity_id
     FROM matches m WHERE m.id = ?`,
    [matchId]
  );
  if (!match) return null;
  const players = await all<MatchEvaluationPlayer>(
    `WITH source_activity AS (
       SELECT id FROM development_activities WHERE match_id = ? ORDER BY id LIMIT 1
     ), explicit_participants AS (
       SELECT player_id FROM match_squad WHERE match_id = ?
       UNION SELECT player_id FROM match_players WHERE match_id = ?
     ), participants AS (
       SELECT player_id FROM explicit_participants
       UNION
       SELECT dac.player_id
       FROM development_activity_callups dac JOIN source_activity sa ON sa.id = dac.activity_id
       WHERE dac.attendance_status = 'present'
         AND NOT EXISTS (SELECT 1 FROM explicit_participants)
     )
     SELECT p.id, p.name, p.jersey_number, p.level, e.self_comparison, e.match_impact,
            COALESCE(e.reason_tag, '') AS reason_tag, COALESCE(e.skipped, 0) AS skipped
     FROM participants part JOIN players p ON p.id = part.player_id AND p.active = 1
     LEFT JOIN match_player_evaluations e ON e.match_id = ? AND e.player_id = p.id
       AND e.contributor_type = ? AND e.contributor_id = ?
     ORDER BY lower(p.name)`, [matchId, matchId, matchId, matchId, contributorType, contributorId]
  );
  return { match, players };
}

export type EvaluationInvite = { id: number; label: string; expires_at: string; revoked_at: string | null; completed_count: number };
export async function getMatchEvaluationInvites(matchId: number): Promise<EvaluationInvite[]> {
  return all<EvaluationInvite>(
    `SELECT i.id, i.label, i.expires_at::text, i.revoked_at::text, COUNT(e.id)::int AS completed_count
     FROM match_evaluation_invites i
     LEFT JOIN match_player_evaluations e ON e.contributor_type = 'invite' AND e.contributor_id = i.id::text
     WHERE i.match_id = ? GROUP BY i.id ORDER BY i.created_at DESC`, [matchId]
  );
}
export async function getPublicEvaluationWorkspace(token: string): Promise<(MatchEvaluationWorkspace & { invite: EvaluationInvite }) | null> {
  if (token.length < 32 || token.length > 128) return null;
  const invite = await get<EvaluationInvite & { match_id: number }>(
    `SELECT id, match_id, label, expires_at::text, revoked_at::text, 0 AS completed_count
     FROM match_evaluation_invites WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > now()`,
    [evaluationTokenHash(token)]
  );
  if (!invite) return null;
  const workspace = await getMatchEvaluationWorkspace(invite.match_id, "invite", String(invite.id));
  return workspace ? { ...workspace, invite } : null;
}
export async function getMatchEvaluationStatus(matchId: number) {
  return (await get<{ total: number; evaluated: number; contributors: number }>(
    `WITH source_activity AS (
       SELECT id FROM development_activities WHERE match_id = ? ORDER BY id LIMIT 1
     ), explicit_participants AS (
       SELECT player_id FROM match_squad WHERE match_id = ?
       UNION SELECT player_id FROM match_players WHERE match_id = ?
     ), participants AS (
       SELECT player_id FROM explicit_participants
       UNION
       SELECT dac.player_id
       FROM development_activity_callups dac JOIN source_activity sa ON sa.id = dac.activity_id
       WHERE dac.attendance_status = 'present'
         AND NOT EXISTS (SELECT 1 FROM explicit_participants)
     )
     SELECT COUNT(DISTINCT part.player_id)::int AS total, COUNT(DISTINCT e.player_id)::int AS evaluated,
            COUNT(DISTINCT (e.contributor_type || ':' || e.contributor_id))::int AS contributors
     FROM participants part LEFT JOIN match_player_evaluations e ON e.match_id = ? AND e.player_id = part.player_id`,
    [matchId, matchId, matchId, matchId]
  )) ?? { total: 0, evaluated: 0, contributors: 0 };
}
export async function getPendingMatchEvaluation(): Promise<null | { id: number; opponent: string; date: string; total: number; evaluated: number }> {
  const today = swedishToday();
  const nowMinutes = swedishMinutesSinceMidnight();
  const cutoffDate = new Date(`${today}T12:00:00Z`);
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - 7);
  const recentCutoff = cutoffDate.toISOString().slice(0, 10);
  const matches = await all<{ id: number; opponent: string; date: string; start_time: string | null; group_id: number | null }>(
    `SELECT DISTINCT m.id, m.opponent, m.date, m.start_time, m.group_id
     FROM matches m
     JOIN development_activities da ON da.match_id = m.id
     JOIN groups g ON g.id = da.group_id
     WHERE m.date BETWEEN ? AND ?
       AND da.external_source = 'svenskalag_sanktan'
       AND lower(g.name) = 'gul'
     ORDER BY m.date DESC, m.id DESC
     LIMIT 20`, [recentCutoff, today]
  );
  for (const match of matches) {
    if (!matchEvaluationIsOpen(match.date, match.start_time, today, nowMinutes)) continue;
    if (!(await canAccessGroup(match.group_id))) continue;
    const status = await getMatchEvaluationStatus(match.id);
    if (status.total > 0 && status.evaluated < status.total) return { ...match, ...status };
  }
  return null;
}

export type MatchEvaluationTrendPoint = {
  match_id: number; date: string; opponent: string; self_comparison: SelfComparison;
  match_impact: MatchImpact; disagreement: boolean; contributor_count: number;
};
const SELF_VALUE: Record<SelfComparison, number> = { below: -1, usual: 0, above: 1 };
const IMPACT_VALUE: Record<MatchImpact, number> = { struggled: -1, held: 0, influenced: 1 };
function consensusKey<T extends string>(values: T[], scores: Record<T, number>): T {
  const average = values.reduce((sum, value) => sum + scores[value], 0) / values.length;
  return [...values].sort((a, b) => {
    const distance = Math.abs(scores[a] - average) - Math.abs(scores[b] - average);
    return distance || Math.abs(scores[a]) - Math.abs(scores[b]);
  })[0];
}
export async function getPlayerMatchEvaluationTrend(playerId: number): Promise<MatchEvaluationTrendPoint[]> {
  const rows = await all<{ match_id: number; date: string; opponent: string; self_comparison: SelfComparison; match_impact: MatchImpact }>(
    `SELECT e.match_id, m.date, m.opponent, e.self_comparison, e.match_impact
     FROM match_player_evaluations e JOIN matches m ON m.id = e.match_id
     WHERE e.player_id = ? AND COALESCE(e.skipped, 0) = 0
     ORDER BY m.date DESC, m.id DESC, e.id`, [playerId]
  );
  const grouped = new Map<number, typeof rows>();
  for (const row of rows) grouped.set(row.match_id, [...(grouped.get(row.match_id) ?? []), row]);
  return [...grouped.values()].slice(0, 12).map((group) => {
    const self = group.map((row) => row.self_comparison);
    const impact = group.map((row) => row.match_impact);
    const selfSpread = Math.max(...self.map((v) => SELF_VALUE[v])) - Math.min(...self.map((v) => SELF_VALUE[v]));
    const impactSpread = Math.max(...impact.map((v) => IMPACT_VALUE[v])) - Math.min(...impact.map((v) => IMPACT_VALUE[v]));
    return {
      match_id: group[0].match_id, date: group[0].date, opponent: group[0].opponent,
      self_comparison: consensusKey(self, SELF_VALUE), match_impact: consensusKey(impact, IMPACT_VALUE),
      disagreement: selfSpread >= 2 || impactSpread >= 2, contributor_count: group.length,
    };
  });
}
