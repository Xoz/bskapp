import "server-only";

import { all, get } from "./db";
import { canAccessGroup, canAccessPlayer, getCurrentUser, isStaffRole } from "./auth";
import { getPlayers, type Player } from "./queries";
import { swedishDateOffset, swedishToday } from "./dates";
import {
  selectionSupport,
  squadBalanceWarnings,
  type RecommendationCallupStatus,
  type SelectionSupport,
} from "./selectionSupport";
import { selectionDecisionFromCallups } from "./callupSync";

export type CoreActivityType = "training" | "match" | "other";
export type Evidence = "shown" | "practicing" | "revisit";
export type GoalStatus = "active" | "achieved" | "paused";

export type CoreActivity = {
  id: string;
  activity_date: string;
  start_time: string | null;
  activity_type: CoreActivityType;
  title: string;
  external_source: string;
  external_key: string;
  match_id: number | null;
  group_id: number | null;
  theme: string;
  challenge_context: "safe" | "balanced" | "challenging";
  observation_count: number;
  participant_count: number;
  selection_count: number;
  source_team: string | null;
  competition_level: number | null;
  participant_names: string[];
  called_player_names: string[];
  declined_player_names: string[];
  accepted_callup_count: number;
  declined_callup_count: number;
  pending_callup_count: number;
  is_upcoming: boolean;
};

export type DevelopmentGoal = {
  id: string;
  player_id: number;
  slot: 1 | 2;
  title: string;
  evidence_hint: string;
  status: GoalStatus;
  starts_on: string;
  review_on: string | null;
  ended_on: string | null;
  created_by: string;
};

export type DevelopmentObservation = {
  id: string;
  activity_id: string;
  activity_date: string;
  activity_title: string;
  activity_type: CoreActivityType;
  player_id: number | null;
  player_name: string | null;
  goal_id: string | null;
  goal_title: string | null;
  evidence: Evidence;
  note: string;
  coach_name: string;
  created_at: string;
};

export type PlayerCoreSummary = {
  player: Player;
  teams: { id: number; name: string; isPrimary: boolean }[];
  primaryTeam: { id: number; name: string } | null;
  goals: DevelopmentGoal[];
  lastObservation: DevelopmentObservation | null;
  trainingCount: number;
  matchCount: number;
  hasSanktanSync: boolean;
  sanktanGulCount: number;
  sanktanGronCount: number;
  callupCount: number;
  selectedCount: number;
  periodsPlayed: number;
};

export type CompetitionMatchHistory = {
  external_id: string;
  season: number;
  source_team: "Gul" | "Grön";
  level: number | null;
  match_date: string;
  start_time: string | null;
  opponent: string;
  home_away: "home" | "away";
  location: string | null;
};

function placeholders(values: unknown[]): string {
  return values.map(() => "?").join(", ");
}

async function activityScope(alias = "da"): Promise<{ sql: string; args: number[] } | null> {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.primaryRole)) return null;
  if (user.roles.includes("admin") || user.groupIds.length === 0) return { sql: "1 = 1", args: [] };
  return {
    sql: `(${alias}.group_id IS NULL OR ${alias}.group_id IN (${placeholders(user.groupIds)}))`,
    args: user.groupIds,
  };
}

export async function getCoreActivities(limit = 80, source: "all" | "sanktan" = "all"): Promise<CoreActivity[]> {
  const scope = await activityScope();
  if (!scope) return [];
  const sourceFilter = source === "sanktan"
    ? "AND da.external_source = 'svenskalag_sanktan'"
    : `AND NOT (
         da.activity_type = 'match'
         AND da.external_source <> 'svenskalag_sanktan'
         AND EXISTS (
           SELECT 1 FROM player_competition_matches preferred_pcm
           WHERE preferred_pcm.competition = 'sanktan'
             AND preferred_pcm.match_date = da.activity_date
             AND COALESCE(preferred_pcm.start_time, '') = COALESCE(da.start_time, '')
             AND lower(da.title) LIKE '%' || lower(preferred_pcm.opponent) || '%'
         )
       )
       AND NOT (
         da.activity_type = 'match'
         AND da.external_source = 'svenskalag_attendance'
         AND EXISTS (
           SELECT 1 FROM development_activities linked_da
           WHERE linked_da.match_id IS NOT NULL
             AND linked_da.activity_date = da.activity_date
             AND COALESCE(linked_da.start_time, '') = COALESCE(da.start_time, '')
             AND lower(regexp_replace(linked_da.title, '^(Match mot|Hemma mot|Borta mot)\\s+', ''))
                 = lower(regexp_replace(da.title, '^(Match mot|Hemma mot|Borta mot)\\s+', ''))
         )
       )`;
  return all<CoreActivity>(
    `SELECT da.id, da.activity_date, da.start_time, da.activity_type, da.title,
            da.external_source, da.external_key, da.match_id, da.group_id,
            da.theme, da.challenge_context,
            COALESCE(pcm.source_team, CASE WHEN g.group_type = 'subgroup' THEN g.name END) AS source_team,
            COALESCE(pcm.level, CASE WHEN m.level ~ '^[0-9]+$' THEN m.level::integer END) AS competition_level,
            COALESCE(
              (SELECT s.accepted_count FROM development_activity_callup_summaries s WHERE s.activity_id = da.id),
              (SELECT COUNT(*) FROM development_activity_callups dac WHERE dac.activity_id = da.id AND dac.attendance_status = 'present')
            ) AS accepted_callup_count,
            COALESCE(
              (SELECT s.declined_count FROM development_activity_callup_summaries s WHERE s.activity_id = da.id),
              (SELECT COUNT(*) FROM development_activity_callups dac WHERE dac.activity_id = da.id AND dac.attendance_status = 'absent')
            ) AS declined_callup_count,
            COALESCE(
              (SELECT s.pending_count FROM development_activity_callup_summaries s WHERE s.activity_id = da.id),
              (SELECT COUNT(*) FROM development_activity_callups dac WHERE dac.activity_id = da.id AND dac.attendance_status = 'unknown')
            ) AS pending_callup_count,
            da.activity_date >= to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD') AS is_upcoming,
            ARRAY(
              SELECT p2.name
              FROM development_activity_participation ap2
              JOIN players p2 ON p2.id = ap2.player_id
              WHERE ap2.activity_id = da.id AND ap2.attendance_status = 'present'
              ORDER BY p2.name
            ) AS participant_names,
            ARRAY(
              SELECT p2.name
              FROM development_activity_callups dac
              JOIN players p2 ON p2.id = dac.player_id
              WHERE dac.activity_id = da.id
              ORDER BY p2.name
            ) AS called_player_names,
            ARRAY(
              SELECT p2.name
              FROM development_activity_callups dac
              JOIN players p2 ON p2.id = dac.player_id
              WHERE dac.activity_id = da.id AND dac.attendance_status = 'absent'
              ORDER BY p2.name
            ) AS declined_player_names,
            COUNT(DISTINCT o.id) AS observation_count,
            COUNT(DISTINCT CASE WHEN ap.attendance_status = 'present' THEN ap.player_id END) AS participant_count,
            COUNT(DISTINCT CASE WHEN sd.decision = 'selected' THEN sd.player_id END) AS selection_count
     FROM development_activities da
     LEFT JOIN development_observations o ON o.activity_id = da.id
     LEFT JOIN development_activity_participation ap ON ap.activity_id = da.id
     LEFT JOIN development_selection_decisions sd ON sd.activity_id = da.id
     LEFT JOIN player_competition_matches pcm ON da.external_key = 'sanktan:' || pcm.external_id
     LEFT JOIN matches m ON m.id = da.match_id
     LEFT JOIN groups g ON g.id = da.group_id
     WHERE ${scope.sql}
       ${sourceFilter}
     GROUP BY da.id, pcm.source_team, pcm.level, m.level, g.group_type, g.name
     ORDER BY
       CASE WHEN da.activity_date >= to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD') THEN 0 ELSE 1 END,
       CASE WHEN da.activity_date >= to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD') THEN da.activity_date END ASC,
       CASE WHEN da.activity_date >= to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD') THEN da.start_time END ASC NULLS LAST,
       da.activity_date DESC, da.start_time DESC NULLS LAST, da.id DESC
     LIMIT ?`,
    [...scope.args, limit]
  );
}

export async function getCoreHome() {
  const activities = await getCoreActivities(120);
  const today = swedishToday();
  const currentDate = new Date(`${today}T12:00:00Z`);
  const daysUntilSunday = (7 - currentDate.getUTCDay()) % 7;
  currentDate.setUTCDate(currentDate.getUTCDate() + daysUntilSunday);
  const weekEnd = currentDate.toISOString().slice(0, 10);
  const yellowSanktanMatches = activities.filter((activity) =>
    activity.activity_type === "match"
    && activity.external_source === "svenskalag_sanktan"
    && activity.source_team === "Gul"
  );
  const upcoming = yellowSanktanMatches
    .filter((activity) => activity.activity_date >= today && activity.activity_date <= weekEnd)
    .sort((a, b) => a.activity_date.localeCompare(b.activity_date) || (a.start_time ?? "").localeCompare(b.start_time ?? ""))
    .slice(0, 6);
  const recent = yellowSanktanMatches
    .filter((activity) => activity.activity_date < today)
    .sort((a, b) => b.activity_date.localeCompare(a.activity_date) || (b.start_time ?? "").localeCompare(a.start_time ?? ""))
    .slice(0, 6);
  const metrics = await getPilotMetrics();
  return { today, upcoming, recent, metrics };
}

export async function getPlayerCoreSummaries(): Promise<PlayerCoreSummary[]> {
  const players = await getPlayers();
  if (players.length === 0) return [];
  const ids = players.map((player) => player.id);
  const idSql = placeholders(ids);
  const today = swedishToday();
  const [goals, lastObservations, exposure, teamMemberships] = await Promise.all([
    all<DevelopmentGoal>(
      `SELECT id, player_id, slot, title, evidence_hint, status, starts_on, review_on, ended_on, created_by
       FROM player_development_goals
       WHERE player_id IN (${idSql}) AND status = 'active'
       ORDER BY player_id, slot`,
      ids
    ),
    all<DevelopmentObservation>(
      `SELECT DISTINCT ON (o.player_id)
              o.id, o.activity_id, da.activity_date, da.title AS activity_title,
              da.activity_type, o.player_id, p.name AS player_name,
              o.goal_id, g.title AS goal_title, o.evidence, o.note, o.coach_name, o.created_at
       FROM development_observations o
       JOIN development_activities da ON da.id = o.activity_id
       LEFT JOIN players p ON p.id = o.player_id
       LEFT JOIN player_development_goals g ON g.id = o.goal_id
       WHERE o.player_id IN (${idSql})
       ORDER BY o.player_id, da.activity_date DESC, o.created_at DESC`,
      ids
    ),
    all<{
      player_id: number;
      training_count: number;
      match_count: number;
      has_sanktan_sync: boolean;
      sanktan_gul_count: number;
      sanktan_gron_count: number;
      callup_count: number;
      selected_count: number;
      periods_played: number;
    }>(
      `SELECT p.id AS player_id,
              COUNT(DISTINCT CASE WHEN da.activity_type = 'training' AND ap.attendance_status = 'present' THEN da.id END) AS training_count,
              COALESCE(
                (SELECT SUM(pcmc.match_count)
                 FROM player_competition_match_counts pcmc
                 WHERE pcmc.player_id = p.id
                   AND pcmc.competition = 'sanktan'
                   AND pcmc.season = (SELECT MAX(season) FROM player_competition_match_counts WHERE competition = 'sanktan')),
                COUNT(DISTINCT CASE WHEN da.activity_type = 'match' AND ap.attendance_status = 'present' THEN da.id END)
              ) AS match_count,
              EXISTS(
                SELECT 1 FROM player_competition_match_counts pcmc
                WHERE pcmc.player_id = p.id
                  AND pcmc.competition = 'sanktan'
                  AND pcmc.season = (SELECT MAX(season) FROM player_competition_match_counts WHERE competition = 'sanktan')
              ) AS has_sanktan_sync,
              COALESCE((
                SELECT SUM(pcmc.match_count) FROM player_competition_match_counts pcmc
                WHERE pcmc.player_id = p.id AND pcmc.competition = 'sanktan' AND pcmc.source_team = 'Gul'
                  AND pcmc.season = (SELECT MAX(season) FROM player_competition_match_counts WHERE competition = 'sanktan')
              ), 0) AS sanktan_gul_count,
              COALESCE((
                SELECT SUM(pcmc.match_count) FROM player_competition_match_counts pcmc
                WHERE pcmc.player_id = p.id AND pcmc.competition = 'sanktan' AND pcmc.source_team = 'Grön'
                  AND pcmc.season = (SELECT MAX(season) FROM player_competition_match_counts WHERE competition = 'sanktan')
              ), 0) AS sanktan_gron_count,
              (SELECT COUNT(DISTINCT dac.activity_id)
               FROM development_activity_callups dac
               JOIN development_activities callup_da ON callup_da.id = dac.activity_id
               WHERE dac.player_id = p.id
                 AND callup_da.external_source = 'svenskalag_sanktan'
                 AND callup_da.activity_date LIKE ?
              ) AS callup_count,
              COUNT(DISTINCT CASE WHEN COALESCE(sd.decision, CASE WHEN ap.selected = 1 THEN 'selected' END) = 'selected' THEN da.id END) AS selected_count,
              COALESCE(SUM(ap.periods_played), 0) AS periods_played
       FROM players p
       LEFT JOIN development_activity_participation ap ON ap.player_id = p.id
       LEFT JOIN development_activities da ON da.id = ap.activity_id
       LEFT JOIN development_selection_decisions sd ON sd.activity_id = da.id AND sd.player_id = p.id
       WHERE p.id IN (${idSql})
       GROUP BY p.id`,
      [`${today.slice(0, 4)}-%`, ...ids]
    ),
    all<{ player_id: number; id: number; name: string; is_primary: number }>(
      `SELECT pgm.player_id, g.id, g.name, pgm.is_primary
       FROM player_group_memberships pgm
       JOIN groups g ON g.id = pgm.group_id
       WHERE pgm.player_id IN (${idSql})
         AND g.group_type = 'subgroup'
         AND g.active = 1
         AND (pgm.starts_on IS NULL OR pgm.starts_on <= ?)
         AND (pgm.ends_on IS NULL OR pgm.ends_on >= ?)
       ORDER BY pgm.is_primary DESC, lower(g.name)`,
      [...ids, today, today]
    ),
  ]);

  const goalsByPlayer = new Map<number, DevelopmentGoal[]>();
  for (const goal of goals) goalsByPlayer.set(goal.player_id, [...(goalsByPlayer.get(goal.player_id) ?? []), goal]);
  const observationByPlayer = new Map(lastObservations.map((row) => [Number(row.player_id), row]));
  const exposureByPlayer = new Map(exposure.map((row) => [row.player_id, row]));
  const teamsByPlayer = new Map<number, { id: number; name: string; isPrimary: boolean }[]>();
  for (const team of teamMemberships) {
    teamsByPlayer.set(team.player_id, [...(teamsByPlayer.get(team.player_id) ?? []), {
      id: team.id,
      name: team.name,
      isPrimary: Boolean(team.is_primary),
    }]);
  }

  return players.map((player) => {
    const row = exposureByPlayer.get(player.id);
    const teams = teamsByPlayer.get(player.id) ?? [];
    const primaryTeam = teams.find((team) => team.isPrimary) ?? null;
    return {
      player,
      teams,
      primaryTeam: primaryTeam ? { id: primaryTeam.id, name: primaryTeam.name } : null,
      goals: goalsByPlayer.get(player.id) ?? [],
      lastObservation: observationByPlayer.get(player.id) ?? null,
      trainingCount: Number(row?.training_count ?? 0),
      matchCount: Number(row?.match_count ?? 0),
      hasSanktanSync: Boolean(row?.has_sanktan_sync),
      sanktanGulCount: Number(row?.sanktan_gul_count ?? 0),
      sanktanGronCount: Number(row?.sanktan_gron_count ?? 0),
      callupCount: Number(row?.callup_count ?? 0),
      selectedCount: Number(row?.selected_count ?? 0),
      periodsPlayed: Number(row?.periods_played ?? 0),
    };
  });
}

export async function getPlayerCore(playerId: number): Promise<{
  summary: PlayerCoreSummary;
  goalHistory: DevelopmentGoal[];
  observations: DevelopmentObservation[];
  matchHistory: CompetitionMatchHistory[];
} | null> {
  if (!(await canAccessPlayer(playerId))) return null;
  const summaries = await getPlayerCoreSummaries();
  const summary = summaries.find((row) => row.player.id === playerId);
  if (!summary) return null;
  const [goalHistory, observations, matchHistory] = await Promise.all([
    all<DevelopmentGoal>(
      `SELECT id, player_id, slot, title, evidence_hint, status, starts_on, review_on, ended_on, created_by
       FROM player_development_goals WHERE player_id = ?
       ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, starts_on DESC`,
      [playerId]
    ),
    all<DevelopmentObservation>(
      `SELECT o.id, o.activity_id, da.activity_date, da.title AS activity_title,
              da.activity_type, o.player_id, p.name AS player_name,
              o.goal_id, g.title AS goal_title, o.evidence, o.note, o.coach_name, o.created_at
       FROM development_observations o
       JOIN development_activities da ON da.id = o.activity_id
       LEFT JOIN players p ON p.id = o.player_id
       LEFT JOIN player_development_goals g ON g.id = o.goal_id
       WHERE o.player_id = ?
       ORDER BY da.activity_date DESC, o.created_at DESC
       LIMIT 40`,
      [playerId]
    ),
    all<CompetitionMatchHistory>(
      `SELECT pcm.external_id, pcm.season, pcm.source_team, pcm.level, pcm.match_date,
              pcm.start_time, pcm.opponent, pcm.home_away, pcm.location
       FROM player_competition_match_players pcmp
       JOIN player_competition_matches pcm ON pcm.external_id = pcmp.match_external_id
       WHERE pcmp.player_id = ? AND pcm.competition = 'sanktan'
       ORDER BY pcm.match_date DESC, pcm.start_time DESC NULLS LAST, pcm.external_id DESC`,
      [playerId]
    ),
  ]);
  return { summary, goalHistory, observations, matchHistory };
}

export async function getActivityDetail(activityId: string): Promise<{
  activity: CoreActivity;
  players: PlayerCoreSummary[];
  observations: DevelopmentObservation[];
} | null> {
  const activity = await get<CoreActivity>(
    `SELECT da.*,
            COALESCE(pcm.source_team, CASE WHEN g.group_type = 'subgroup' THEN g.name END) AS source_team,
            COALESCE(pcm.level, CASE WHEN m.level ~ '^[0-9]+$' THEN m.level::integer END) AS competition_level,
            COALESCE(
              (SELECT s.accepted_count FROM development_activity_callup_summaries s WHERE s.activity_id = da.id),
              (SELECT COUNT(*) FROM development_activity_callups dac WHERE dac.activity_id = da.id AND dac.attendance_status = 'present')
            ) AS accepted_callup_count,
            COALESCE(
              (SELECT s.declined_count FROM development_activity_callup_summaries s WHERE s.activity_id = da.id),
              (SELECT COUNT(*) FROM development_activity_callups dac WHERE dac.activity_id = da.id AND dac.attendance_status = 'absent')
            ) AS declined_callup_count,
            COALESCE(
              (SELECT s.pending_count FROM development_activity_callup_summaries s WHERE s.activity_id = da.id),
              (SELECT COUNT(*) FROM development_activity_callups dac WHERE dac.activity_id = da.id AND dac.attendance_status = 'unknown')
            ) AS pending_callup_count,
            da.activity_date >= to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD') AS is_upcoming,
            ARRAY(
              SELECT p2.name
              FROM development_activity_participation ap2
              JOIN players p2 ON p2.id = ap2.player_id
              WHERE ap2.activity_id = da.id AND ap2.attendance_status = 'present'
              ORDER BY p2.name
            ) AS participant_names,
            ARRAY(
              SELECT p2.name
              FROM development_activity_callups dac
              JOIN players p2 ON p2.id = dac.player_id
              WHERE dac.activity_id = da.id
              ORDER BY p2.name
            ) AS called_player_names,
            ARRAY(
              SELECT p2.name
              FROM development_activity_callups dac
              JOIN players p2 ON p2.id = dac.player_id
              WHERE dac.activity_id = da.id AND dac.attendance_status = 'absent'
              ORDER BY p2.name
            ) AS declined_player_names,
            (SELECT COUNT(*) FROM development_observations o WHERE o.activity_id = da.id) AS observation_count,
            (SELECT COUNT(*) FROM development_activity_participation ap WHERE ap.activity_id = da.id AND ap.attendance_status = 'present') AS participant_count,
            (SELECT COUNT(*) FROM development_selection_decisions sd WHERE sd.activity_id = da.id AND sd.decision = 'selected') AS selection_count
     FROM development_activities da
     LEFT JOIN player_competition_matches pcm ON da.external_key = 'sanktan:' || pcm.external_id
     LEFT JOIN matches m ON m.id = da.match_id
     LEFT JOIN groups g ON g.id = da.group_id
     WHERE da.id = ?`,
    [activityId]
  );
  if (!activity || !(await canAccessGroup(activity.group_id))) return null;
  const [allPlayers, observations, participantRows] = await Promise.all([
    getPlayerCoreSummaries(),
    all<DevelopmentObservation>(
      `SELECT o.id, o.activity_id, da.activity_date, da.title AS activity_title,
              da.activity_type, o.player_id, p.name AS player_name,
              o.goal_id, g.title AS goal_title, o.evidence, o.note, o.coach_name, o.created_at
       FROM development_observations o
       JOIN development_activities da ON da.id = o.activity_id
       LEFT JOIN players p ON p.id = o.player_id
       LEFT JOIN player_development_goals g ON g.id = o.goal_id
       WHERE o.activity_id = ? ORDER BY o.created_at DESC`,
      [activityId]
    ),
    all<{ player_id: number }>(
      `SELECT DISTINCT player_id
       FROM development_activity_participation
       WHERE activity_id = ? AND attendance_status = 'present'`,
      [activityId]
    ),
  ]);
  const participantIds = new Set(participantRows.map((row) => Number(row.player_id)));
  const players = activity.activity_type === "match"
    ? allPlayers.filter((row) => participantIds.has(row.player.id))
    : allPlayers;
  return { activity, players, observations };
}

export type SelectionCandidate = PlayerCoreSummary & {
  decision: "selected" | "reserve" | "rested";
  selectedLastEight: number;
  selectedLastThree: number;
  lastSelectedDate: string | null;
  plannedUpcomingCount: number;
  currentCallupStatus: RecommendationCallupStatus;
  support: SelectionSupport;
};

export async function getSelectionWorkspace(activityId: string): Promise<{
  activity: CoreActivity;
  candidates: SelectionCandidate[];
  warnings: string[];
} | null> {
  const detail = await getActivityDetail(activityId);
  if (!detail
    || detail.activity.activity_type !== "match"
    || detail.activity.external_source !== "svenskalag_sanktan"
    || !detail.activity.is_upcoming
  ) return null;
  const candidateSummaries = await getPlayerCoreSummaries();
  const ids = candidateSummaries.map((row) => row.player.id);
  if (ids.length === 0) return { activity: detail.activity, candidates: [], warnings: [] };
  const idSql = placeholders(ids);
  const rows = await all<{
    player_id: number;
    selected_last_eight: number;
    selected_last_three: number;
    last_selected_date: string | null;
    planned_upcoming_count: number;
    current_callup_status: RecommendationCallupStatus;
    decision: "selected" | "reserve" | "rested" | null;
  }>(
     `WITH recent AS (
       SELECT id, activity_date,
              row_number() OVER (ORDER BY activity_date DESC, start_time DESC NULLS LAST, id DESC) AS rn
       FROM development_activities
       WHERE activity_type = 'match'
         AND external_source = 'svenskalag_sanktan'
         AND activity_date LIKE ?
         AND activity_date <= ? AND id <> ?
       ORDER BY activity_date DESC, start_time DESC NULLS LAST, id DESC
       LIMIT 8
     )
     SELECT p.id AS player_id,
            COUNT(DISTINCT CASE
              WHEN ap.source = 'svenskalag_sanktan' AND ap.attendance_status = 'present' THEN r.id
            END) AS selected_last_eight,
            COUNT(DISTINCT CASE
              WHEN r.rn <= 3 AND ap.source = 'svenskalag_sanktan' AND ap.attendance_status = 'present' THEN r.id
            END) AS selected_last_three,
            MAX(CASE
              WHEN ap.source = 'svenskalag_sanktan' AND ap.attendance_status = 'present' THEN r.activity_date
            END) AS last_selected_date,
            (
              SELECT COUNT(DISTINCT future_sd.activity_id)
              FROM development_selection_decisions future_sd
              JOIN development_activities future_da ON future_da.id = future_sd.activity_id
              WHERE future_sd.player_id = p.id
                AND future_sd.decision = 'selected'
                AND future_da.activity_type = 'match'
                AND future_da.external_source = 'svenskalag_sanktan'
                AND future_da.activity_date LIKE ?
                AND future_da.activity_date >= ?
                AND future_da.id <> ?
                AND NOT EXISTS (
                SELECT 1
                  FROM development_activity_callups future_dac
                  WHERE future_dac.activity_id = future_sd.activity_id
                    AND future_dac.player_id = future_sd.player_id
                )
            ) AS planned_upcoming_count,
            (
              SELECT CASE
                WHEN current_dac.attendance_status = 'present' THEN 'accepted'
                WHEN current_dac.attendance_status = 'absent' THEN 'declined'
                ELSE 'pending'
              END
              FROM development_activity_callups current_dac
              WHERE current_dac.activity_id = ?
                AND current_dac.player_id = p.id
              LIMIT 1
            ) AS current_callup_status,
            current_sd.decision
     FROM players p
     LEFT JOIN recent r ON TRUE
     LEFT JOIN development_activity_participation ap ON ap.activity_id = r.id AND ap.player_id = p.id
     LEFT JOIN development_selection_decisions current_sd ON current_sd.activity_id = ? AND current_sd.player_id = p.id
     WHERE p.id IN (${idSql})
     GROUP BY p.id, current_sd.decision`,
    [
      `${detail.activity.activity_date.slice(0, 4)}-%`,
      detail.activity.activity_date,
      activityId,
      `${detail.activity.activity_date.slice(0, 4)}-%`,
      detail.activity.activity_date,
      activityId,
      activityId,
      activityId,
      ...ids,
    ]
  );
  const history = new Map(rows.map((row) => [row.player_id, row]));
  const hasSyncedCallups = Number(detail.activity.accepted_callup_count)
    + Number(detail.activity.declined_callup_count)
    + Number(detail.activity.pending_callup_count) > 0;
  const yellowRows = candidateSummaries
    .filter((summary) => summary.primaryTeam?.name === "Gul")
    .map((summary) => history.get(summary.player.id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  const minimum = yellowRows.length
    ? Math.min(...yellowRows.map((row) => Number(row.selected_last_eight ?? 0)))
    : 0;
  const candidates: SelectionCandidate[] = candidateSummaries.map((summary) => {
    const row = history.get(summary.player.id);
    const signals = {
      selectedLastEight: Number(row?.selected_last_eight ?? 0),
      selectedLastThree: Number(row?.selected_last_three ?? 0),
      teamMinimumLastEight: Number.isFinite(minimum) ? minimum : 0,
      activeGoalCount: summary.goals.length,
      lastSelectedDate: row?.last_selected_date ?? null,
    };
    return {
      ...summary,
      decision: selectionDecisionFromCallups(
        hasSyncedCallups,
        row?.current_callup_status ?? null,
        row?.decision ?? null
      ),
      selectedLastEight: signals.selectedLastEight,
      selectedLastThree: signals.selectedLastThree,
      lastSelectedDate: signals.lastSelectedDate,
      plannedUpcomingCount: Number(row?.planned_upcoming_count ?? 0),
      currentCallupStatus: row?.current_callup_status ?? null,
      support: selectionSupport(signals),
    };
  });
  const orderedCandidates = detail.activity.source_team === "Gul"
    ? [...candidates].sort((left, right) => {
      const priority = (candidate: SelectionCandidate) => {
        if (candidate.primaryTeam?.name === "Gul") return 0;
        if (candidate.primaryTeam?.name === "F15") return 1;
        if (candidate.primaryTeam?.name === "Grön") return 2;
        return 3;
      };
      return priority(left) - priority(right) || left.player.name.localeCompare(right.player.name, "sv");
    })
    : candidates;
  const selected = orderedCandidates.filter((candidate) => candidate.decision === "selected");
  return {
    activity: detail.activity,
    candidates: orderedCandidates,
    warnings: squadBalanceWarnings(
      selected.map((candidate) => ({
        position: candidate.player.position,
        selectedLastThree: candidate.selectedLastThree,
      }))
    ),
  };
}

export type PilotMetrics = {
  playerCount: number;
  playersWithGoals: number;
  goalCoveragePercent: number;
  recentActivityCount: number;
  observedActivityCount: number;
  observedActivityPercent: number;
  selectionCount: number;
  averageObservationSeconds: number | null;
  observationUnderTwoMinutesPercent: number | null;
};

export async function getPilotMetrics(): Promise<PilotMetrics> {
  const cutoff = swedishDateOffset(-28);
  const row = await get<{
    player_count: number;
    players_with_goals: number;
    recent_activity_count: number;
    observed_activity_count: number;
    selection_count: number;
    average_observation_seconds: number | null;
    fast_observation_count: number;
    timed_observation_count: number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM players WHERE active = 1) AS player_count,
       (SELECT COUNT(DISTINCT player_id) FROM player_development_goals WHERE status = 'active') AS players_with_goals,
       (SELECT COUNT(*) FROM development_activities WHERE activity_date BETWEEN ? AND ?) AS recent_activity_count,
       (SELECT COUNT(DISTINCT o.activity_id)
          FROM development_observations o
          JOIN development_activities da ON da.id = o.activity_id
         WHERE da.activity_date BETWEEN ? AND ?) AS observed_activity_count,
       (SELECT COUNT(DISTINCT activity_id) FROM development_selection_decisions WHERE decision = 'selected') AS selection_count,
       (SELECT ROUND(AVG(duration_seconds)) FROM development_pilot_events
         WHERE event_type = 'observation_saved' AND duration_seconds IS NOT NULL) AS average_observation_seconds,
       (SELECT COUNT(*) FROM development_pilot_events
         WHERE event_type = 'observation_saved' AND duration_seconds IS NOT NULL AND duration_seconds <= 120) AS fast_observation_count,
       (SELECT COUNT(*) FROM development_pilot_events
         WHERE event_type = 'observation_saved' AND duration_seconds IS NOT NULL) AS timed_observation_count`,
    [cutoff, swedishToday(), cutoff, swedishToday()]
  );
  const playerCount = Number(row?.player_count ?? 0);
  const playersWithGoals = Number(row?.players_with_goals ?? 0);
  const recentActivityCount = Number(row?.recent_activity_count ?? 0);
  const observedActivityCount = Number(row?.observed_activity_count ?? 0);
  const timed = Number(row?.timed_observation_count ?? 0);
  return {
    playerCount,
    playersWithGoals,
    goalCoveragePercent: playerCount ? Math.round((100 * playersWithGoals) / playerCount) : 0,
    recentActivityCount,
    observedActivityCount,
    observedActivityPercent: recentActivityCount ? Math.round((100 * observedActivityCount) / recentActivityCount) : 0,
    selectionCount: Number(row?.selection_count ?? 0),
    averageObservationSeconds: row?.average_observation_seconds == null ? null : Number(row.average_observation_seconds),
    observationUnderTwoMinutesPercent: timed
      ? Math.round((100 * Number(row?.fast_observation_count ?? 0)) / timed)
      : null,
  };
}
