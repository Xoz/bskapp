import "server-only";

import crypto from "crypto";
import type { CurrentUser, Permission } from "../auth";
import { all, batch, get, logActivity, run, type SqlArgs } from "../db";
import { swedishDateOffset, swedishToday, swedishWallClockToEpoch } from "../dates";
import { matchCapacity } from "../matchCapacity";

export type MobileEvidence = "shown" | "practicing" | "revisit";

export type MobilePlayerSummary = {
  id: number;
  name: string;
  jerseyNumber: number | null;
  position: string;
  primaryPosition: string;
  activeGoals: {
    id: string;
    slot: 1 | 2;
    title: string;
    evidenceHint: string;
    reviewOn: string | null;
  }[];
  lastObservation: {
    id: string;
    activityId: string;
    activityDate: string;
    evidence: MobileEvidence;
    note: string;
    createdAt: string;
  } | null;
};

export type MobilePlayerDetail = MobilePlayerSummary & {
  teams: { id: number; name: string; isPrimary: boolean }[];
  preferences: {
    primaryPosition: string;
    secondaryPosition: string;
    primaryLevel: string;
    secondaryLevel: string;
    assessedAt: string | null;
    assessedBy: string;
    selectionEligible: boolean;
  };
  stats: {
    trainingCount: number;
    matchCount: number;
    callupCount: number;
  };
  matchHistory: {
    id: string;
    date: string;
    startTime: string | null;
    opponent: string;
    homeAway: "home" | "away";
    sourceTeam: string;
    level: number | null;
  }[];
  goals: {
    id: string;
    slot: 1 | 2;
    title: string;
    evidenceHint: string;
    status: "active" | "achieved" | "paused";
    startsOn: string;
    reviewOn: string | null;
    endedOn: string | null;
  }[];
  observations: {
    id: string;
    activityId: string;
    activityDate: string;
    activityTitle: string;
    activityType: "training" | "match" | "other";
    goalId: string | null;
    goalTitle: string | null;
    evidence: MobileEvidence;
    note: string;
    coachName: string;
    createdAt: string;
  }[];
};

export type MobilePlayerMatchLoad = {
  playerId: number;
  name: string;
  jerseyNumber: number | null;
  windowMatchCount: number;
  /** @deprecated Behålls tillfälligt för äldre native-klienter. */
  capacity: number;
  recentMatches: {
    id: string;
    date: string;
    startTime: string | null;
    title: string;
    sourceTeam: string;
  }[];
  upcomingMatches: {
    id: string;
    date: string;
    startTime: string | null;
    title: string;
    sourceTeam: string;
    status: "selected" | "accepted" | "pending";
  }[];
};

export type MobileActivity = {
  id: string;
  matchId: number | null;
  date: string;
  startTime: string | null;
  type: "training" | "match" | "other";
  title: string;
  groupId: number | null;
  theme: string;
  challengeContext: "safe" | "balanced" | "challenging";
  observationCount: number;
  isPrimaryMatch: boolean;
  sourceTeam: string;
  matchLevel: "Extra svår" | "Svår" | "Medel" | "Lätt" | "Extra lätt" | "Öppen klass";
  loanedPlayerNames: string[];
  finished: boolean;
  acceptedCallupCount: number;
  declinedCallupCount: number;
  pendingCallupCount: number;
  squadCount: number;
  hasConfirmedSquad: boolean;
  squadPlayerNames: string[];
  acceptedPlayerNames: string[];
};

export type MobileSelectionMatch = {
  id: string;
  date: string;
  startTime: string | null;
  title: string;
  sourceTeam: string;
  competitionLevel: number | null;
  acceptedCallupCount: number;
  declinedCallupCount: number;
  pendingCallupCount: number;
  squadCount: number;
  hasConfirmedSquad: boolean;
  /** @deprecated Använd squadCount. Behålls för äldre native-klienter. */
  selectionCount: number;
};

export type MobileSelectionCandidate = {
  playerId: number;
  name: string;
  jerseyNumber: number | null;
  position: string;
  primaryPosition: string;
  secondaryPosition: string;
  primaryLevel: string;
  secondaryLevel: string;
  teamNames: string[];
  decision: "selected" | "reserve" | "rested";
  currentCallupStatus: "accepted" | "declined" | "pending" | null;
  selectedLastEight: number;
  selectedLastThree: number;
  matchCount: number;
  callupCount: number;
  plannedUpcomingCount: number;
  windowMatchCount: number;
  lastSelectedDate: string | null;
};

export type MobileSelectionWorkspace = {
  match: MobileSelectionMatch;
  candidates: MobileSelectionCandidate[];
};

export type MobileSelectionDecision = {
  playerId: number;
  decision: "selected" | "reserve" | "rested";
  position: string;
};

export type CreateObservationCommand = {
  commandId: string;
  playerId: number;
  goalId: string;
  evidence: MobileEvidence;
  note: string;
};

export type ObservationCommandResult = {
  commandId: string;
  observationId: string;
  status: "created" | "replayed";
};

export class DevelopmentServiceError extends Error {
  constructor(
    public readonly code: "unauthorized" | "forbidden" | "not_found" | "invalid" | "idempotency_conflict",
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVIDENCE_VALUES = new Set<MobileEvidence>(["shown", "practicing", "revisit"]);

function requirePermission(actor: CurrentUser, permission: Permission): void {
  if (!actor.permissions.includes(permission)) {
    throw new DevelopmentServiceError("forbidden", "Behörighet saknas.", 403);
  }
}

function placeholders(values: unknown[]): string {
  return values.map(() => "?").join(", ");
}

function playerScope(actor: CurrentUser, alias = "p"): { sql: string; args: SqlArgs } {
  if (actor.roles.includes("admin") || actor.groupIds.length === 0) return { sql: "1 = 1", args: [] };
  const direct = placeholders(actor.groupIds);
  const inherited = placeholders(actor.groupIds);
  return {
    sql: `EXISTS (
      SELECT 1
      FROM player_group_memberships mobile_pgm
      JOIN groups mobile_g ON mobile_g.id = mobile_pgm.group_id
      WHERE mobile_pgm.player_id = ${alias}.id
        AND (mobile_pgm.group_id IN (${direct}) OR mobile_g.parent_id IN (${inherited}))
    )`,
    args: [...actor.groupIds, ...actor.groupIds],
  };
}

function activityScope(actor: CurrentUser, alias = "da"): { sql: string; args: SqlArgs } {
  if (actor.roles.includes("admin") || actor.groupIds.length === 0) return { sql: "1 = 1", args: [] };
  const direct = placeholders(actor.groupIds);
  const inherited = placeholders(actor.groupIds);
  return {
    sql: `(
      ${alias}.group_id IS NULL
      OR ${alias}.group_id IN (${direct})
      OR EXISTS (
        SELECT 1 FROM groups mobile_ag
        WHERE mobile_ag.id = ${alias}.group_id AND mobile_ag.parent_id IN (${inherited})
      )
    )`,
    args: [...actor.groupIds, ...actor.groupIds],
  };
}

type PlayerRow = {
  id: number;
  name: string;
  jersey_number: number | null;
  position: string;
  preferred_position_primary: string;
};

type GoalRow = {
  id: string;
  player_id: number;
  slot: 1 | 2;
  title: string;
  evidence_hint: string;
  status: "active" | "achieved" | "paused";
  starts_on: string;
  review_on: string | null;
  ended_on: string | null;
};

type ObservationRow = {
  id: string;
  activity_id: string;
  activity_date: string;
  activity_title: string;
  activity_type: "training" | "match" | "other";
  player_id: number;
  goal_id: string | null;
  goal_title: string | null;
  evidence: MobileEvidence;
  note: string;
  coach_name: string;
  created_at: string;
};

async function accessiblePlayers(actor: CurrentUser): Promise<PlayerRow[]> {
  requirePermission(actor, "view_players");
  const scope = playerScope(actor);
  return all<PlayerRow>(
    `SELECT p.id, p.name, p.jersey_number, p.position, p.preferred_position_primary
     FROM players p
     WHERE p.active = 1 AND ${scope.sql}
     ORDER BY p.name`,
    scope.args
  );
}

export async function listMobilePlayers(actor: CurrentUser): Promise<MobilePlayerSummary[]> {
  const players = await accessiblePlayers(actor);
  if (players.length === 0) return [];
  const playerIds = players.map((player) => player.id);
  const marks = placeholders(playerIds);
  const [goals, observations] = await Promise.all([
    all<GoalRow>(
      `SELECT id, player_id, slot, title, evidence_hint, status, starts_on, review_on, ended_on
       FROM player_development_goals
       WHERE player_id IN (${marks}) AND status = 'active'
       ORDER BY player_id, slot`,
      playerIds
    ),
    all<ObservationRow>(
      `SELECT DISTINCT ON (o.player_id)
              o.id, o.activity_id, da.activity_date, da.title AS activity_title,
              da.activity_type, o.player_id, o.goal_id, g.title AS goal_title,
              o.evidence, o.note, o.coach_name, o.created_at
       FROM development_observations o
       JOIN development_activities da ON da.id = o.activity_id
       LEFT JOIN player_development_goals g ON g.id = o.goal_id
       WHERE o.player_id IN (${marks})
       ORDER BY o.player_id, da.activity_date DESC, o.created_at DESC`,
      playerIds
    ),
  ]);
  const goalsByPlayer = new Map<number, GoalRow[]>();
  for (const goal of goals) goalsByPlayer.set(goal.player_id, [...(goalsByPlayer.get(goal.player_id) ?? []), goal]);
  const observationByPlayer = new Map(observations.map((observation) => [observation.player_id, observation]));

  return players.map((player) => {
    const last = observationByPlayer.get(player.id);
    return {
      id: player.id,
      name: player.name,
      jerseyNumber: player.jersey_number,
      position: player.position,
      primaryPosition: player.preferred_position_primary,
      activeGoals: (goalsByPlayer.get(player.id) ?? []).map((goal) => ({
        id: goal.id,
        slot: goal.slot,
        title: goal.title,
        evidenceHint: goal.evidence_hint,
        reviewOn: goal.review_on,
      })),
      lastObservation: last ? {
        id: last.id,
        activityId: last.activity_id,
        activityDate: last.activity_date,
        evidence: last.evidence,
        note: last.note,
        createdAt: last.created_at,
      } : null,
    };
  });
}

export async function listMobilePlayerMatchLoads(actor: CurrentUser): Promise<MobilePlayerMatchLoad[]> {
  requirePermission(actor, "view_players");
  const scope = playerScope(actor);
  const today = swedishToday();
  const cutoff = swedishDateOffset(-7);
  const windowEnd = swedishDateOffset(7);
  const players = await all<{ id: number; name: string; jersey_number: number | null }>(
    `SELECT p.id, p.name, p.jersey_number
     FROM players p
     JOIN player_group_memberships pgm ON pgm.player_id = p.id AND pgm.is_primary = 1
     JOIN groups g ON g.id = pgm.group_id AND g.group_type = 'subgroup' AND g.active = 1
     WHERE p.active = 1 AND g.name = 'Gul' AND ${scope.sql}
       AND (pgm.starts_on IS NULL OR pgm.starts_on <= ?)
       AND (pgm.ends_on IS NULL OR pgm.ends_on >= ?)
     ORDER BY lower(p.name)`,
    [...scope.args, today, today]
  );
  if (players.length === 0) return [];
  const playerIds = players.map((player) => player.id);
  const marks = placeholders(playerIds);
  const [recentRows, upcomingRows] = await Promise.all([
    all<{
      player_id: number;
      external_id: string;
      match_date: string;
      start_time: string | null;
      title: string;
      source_team: string;
    }>(
      `SELECT mp.player_id, m.id::text AS external_id, m.date AS match_date,
              m.start_time, 'Mot ' || m.opponent AS title,
              COALESCE(g.name, '') AS source_team
       FROM match_players mp
       JOIN matches m ON m.id = mp.match_id
       LEFT JOIN groups g ON g.id = m.group_id
       WHERE mp.player_id IN (${marks})
         AND (m.finished = 1 OR m.date <= ?)
         AND m.date >= ? AND m.date <= ?
       ORDER BY m.date DESC, m.start_time DESC NULLS LAST, m.id`,
      [...playerIds, today, cutoff, today]
    ),
    all<{
      player_id: number;
      id: string;
      activity_date: string;
      start_time: string | null;
      title: string;
      source_team: string;
      status: "selected" | "accepted" | "pending";
    }>(
      `SELECT linked.player_id, da.id, da.activity_date, da.start_time, da.title,
              COALESCE(g.name, '') AS source_team,
              CASE
                WHEN linked.in_squad OR linked.selected_decision THEN 'selected'
                WHEN linked.callup_status = 'present' THEN 'accepted'
                ELSE 'pending'
              END AS status
       FROM development_activities da
       LEFT JOIN matches linked_match ON linked_match.id = da.match_id
       LEFT JOIN groups g ON g.id = da.group_id
       JOIN LATERAL (
         SELECT p.id AS player_id,
                EXISTS (SELECT 1 FROM match_squad ms WHERE ms.match_id = da.match_id AND ms.player_id = p.id) AS in_squad,
                EXISTS (SELECT 1 FROM development_selection_decisions sd WHERE sd.activity_id = da.id AND sd.player_id = p.id AND sd.decision = 'selected') AS selected_decision,
                (SELECT dac.attendance_status FROM development_activity_callups dac WHERE dac.activity_id = da.id AND dac.player_id = p.id LIMIT 1) AS callup_status,
                EXISTS (SELECT 1 FROM match_squad any_ms WHERE any_ms.match_id = da.match_id) AS has_saved_squad
         FROM players p
         WHERE p.id IN (${marks})
       ) linked ON (
         linked.in_squad
         OR (
           NOT linked.has_saved_squad
           AND (linked.selected_decision OR linked.callup_status IN ('present', 'unknown'))
         )
       )
       WHERE da.activity_type = 'match'
         AND da.activity_date >= ? AND da.activity_date <= ?
         AND COALESCE(linked_match.finished, 0) = 0
       ORDER BY da.activity_date, da.start_time NULLS LAST, da.id`,
      [...playerIds, today, windowEnd]
    ),
  ]);

  const recentByPlayer = new Map<number, MobilePlayerMatchLoad["recentMatches"]>();
  for (const row of recentRows) {
    recentByPlayer.set(row.player_id, [...(recentByPlayer.get(row.player_id) ?? []), {
      id: row.external_id,
      date: row.match_date,
      startTime: row.start_time,
      title: row.title,
      sourceTeam: row.source_team,
    }]);
  }
  const upcomingByPlayer = new Map<number, MobilePlayerMatchLoad["upcomingMatches"]>();
  for (const row of upcomingRows) {
    upcomingByPlayer.set(row.player_id, [...(upcomingByPlayer.get(row.player_id) ?? []), {
      id: row.id,
      date: row.activity_date,
      startTime: row.start_time,
      title: row.title,
      sourceTeam: row.source_team,
      status: row.status,
    }]);
  }
  const nowMs = Date.now();
  return players
    .map((player) => {
      const recentMatches = recentByPlayer.get(player.id) ?? [];
      return {
        playerId: player.id,
        name: player.name,
        jerseyNumber: player.jersey_number,
        windowMatchCount: recentMatches.length + (upcomingByPlayer.get(player.id) ?? []).length,
        capacity: matchCapacity(recentMatches, nowMs, swedishWallClockToEpoch),
        recentMatches,
        upcomingMatches: upcomingByPlayer.get(player.id) ?? [],
      };
    })
    .sort((left, right) => left.windowMatchCount - right.windowMatchCount || left.name.localeCompare(right.name, "sv"));
}

export async function listMobileActivityPlayers(actor: CurrentUser, activityId: string): Promise<MobilePlayerSummary[]> {
  requirePermission(actor, "manage_evaluations");
  if (!activityId) throw new DevelopmentServiceError("invalid", "Aktivitet saknas.", 400);
  const scope = activityScope(actor);
  const rows = await all<{
    id: number;
    name: string;
    jersey_number: number | null;
    position: string;
    preferred_position_primary: string;
    active_goals: MobilePlayerSummary["activeGoals"];
  }>(
    `WITH target AS (
       SELECT da.id, da.match_id
       FROM development_activities da
       WHERE da.id = ? AND da.activity_type = 'match' AND ${scope.sql}
     ), explicit_participants AS (
       SELECT ms.player_id
       FROM target t JOIN match_squad ms ON ms.match_id = t.match_id
       UNION
       SELECT sd.player_id
       FROM target t
       JOIN development_selection_decisions sd ON sd.activity_id = t.id
       WHERE sd.decision = 'selected'
       UNION
       SELECT dap.player_id
       FROM target t
       JOIN development_activity_participation dap ON dap.activity_id = t.id
       WHERE dap.selected = 1
     ), accepted_callups AS (
       SELECT dac.player_id
       FROM target t
       JOIN development_activity_callups dac ON dac.activity_id = t.id
       WHERE dac.attendance_status = 'present'
     ), participants AS (
       SELECT player_id FROM explicit_participants
       UNION
       SELECT player_id FROM accepted_callups
       WHERE NOT EXISTS (SELECT 1 FROM explicit_participants)
     )
     SELECT p.id, p.name, p.jersey_number, p.position, p.preferred_position_primary,
            COALESCE((
              SELECT json_agg(json_build_object(
                'id', g.id,
                'slot', g.slot,
                'title', g.title,
                'evidenceHint', g.evidence_hint,
                'reviewOn', g.review_on
              ) ORDER BY g.slot)
              FROM player_development_goals g
              WHERE g.player_id = p.id AND g.status = 'active'
            ), '[]'::json) AS active_goals
     FROM participants part
     JOIN players p ON p.id = part.player_id AND p.active = 1
     ORDER BY lower(p.name)`,
    [activityId, ...scope.args]
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    jerseyNumber: row.jersey_number,
    position: row.position,
    primaryPosition: row.preferred_position_primary,
    activeGoals: row.active_goals ?? [],
    lastObservation: null,
  }));
}

export async function getMobilePlayer(actor: CurrentUser, playerId: number): Promise<MobilePlayerDetail> {
  if (!Number.isInteger(playerId) || playerId < 1) {
    throw new DevelopmentServiceError("invalid", "Ogiltigt spelar-id.", 400);
  }
  const summary = (await listMobilePlayers(actor)).find((player) => player.id === playerId);
  if (!summary) throw new DevelopmentServiceError("not_found", "Spelaren hittades inte.", 404);
  const [profile, teams, stats, matchHistory, goals, observations] = await Promise.all([
    get<{
      preferred_position_primary: string;
      preferred_position_secondary: string;
      preferred_level_primary: string;
      preferred_level_secondary: string;
      level_assessed_at: string | null;
      level_assessed_by: string;
      selection_eligible: number;
    }>(
      `SELECT preferred_position_primary, preferred_position_secondary,
              preferred_level_primary, preferred_level_secondary,
              level_assessed_at::text, level_assessed_by, selection_eligible
       FROM players WHERE id = ?`,
      [playerId]
    ),
    all<{ id: number; name: string; is_primary: number }>(
      `SELECT g.id, g.name, pgm.is_primary
       FROM player_group_memberships pgm
       JOIN groups g ON g.id = pgm.group_id
       WHERE pgm.player_id = ? AND g.active = 1
       ORDER BY pgm.is_primary DESC, lower(g.name)`,
      [playerId]
    ),
    get<{ training_count: number; match_count: number; callup_count: number }>(
      `SELECT
         (SELECT COUNT(DISTINCT ap.activity_id) FROM development_activity_participation ap JOIN development_activities da ON da.id = ap.activity_id WHERE ap.player_id = ? AND ap.attendance_status = 'present' AND da.activity_type = 'training') AS training_count,
         (SELECT COUNT(DISTINCT mp.match_id)
          FROM match_players mp JOIN matches m ON m.id = mp.match_id
          WHERE mp.player_id = ? AND (m.finished = 1 OR m.date <= ?)) AS match_count,
         (SELECT COUNT(DISTINCT dac.activity_id) FROM development_activity_callups dac WHERE dac.player_id = ?) AS callup_count`,
      [playerId, playerId, swedishToday(), playerId]
    ),
    all<{
      external_id: string;
      match_date: string;
      start_time: string | null;
      opponent: string;
      home_away: "home" | "away";
      source_team: string;
      level: number | null;
    }>(
      `SELECT m.id::text AS external_id, m.date AS match_date, m.start_time,
              m.opponent, m.home_away, COALESCE(g.name, '') AS source_team,
              CASE WHEN m.level ~ '^[0-9]+$' THEN m.level::integer END AS level
       FROM match_players mp
       JOIN matches m ON m.id = mp.match_id
       LEFT JOIN groups g ON g.id = m.group_id
       WHERE mp.player_id = ? AND (m.finished = 1 OR m.date <= ?)
       ORDER BY m.date DESC, m.start_time DESC NULLS LAST, m.id DESC
       LIMIT 30`,
      [playerId, swedishToday()]
    ),
    all<GoalRow>(
      `SELECT id, player_id, slot, title, evidence_hint, status, starts_on, review_on, ended_on
       FROM player_development_goals
       WHERE player_id = ?
       ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, starts_on DESC`,
      [playerId]
    ),
    all<ObservationRow>(
      `SELECT o.id, o.activity_id, da.activity_date, da.title AS activity_title,
              da.activity_type, o.player_id, o.goal_id, g.title AS goal_title,
              o.evidence, o.note, o.coach_name, o.created_at
       FROM development_observations o
       JOIN development_activities da ON da.id = o.activity_id
       LEFT JOIN player_development_goals g ON g.id = o.goal_id
       WHERE o.player_id = ?
       ORDER BY da.activity_date DESC, o.created_at DESC
       LIMIT 40`,
      [playerId]
    ),
  ]);
  return {
    ...summary,
    teams: teams.map((team) => ({ id: team.id, name: team.name, isPrimary: Boolean(team.is_primary) })),
    preferences: {
      primaryPosition: profile?.preferred_position_primary ?? "",
      secondaryPosition: profile?.preferred_position_secondary ?? "",
      primaryLevel: profile?.preferred_level_primary ?? "",
      secondaryLevel: profile?.preferred_level_secondary ?? "",
      assessedAt: profile?.level_assessed_at ?? null,
      assessedBy: profile?.level_assessed_by ?? "",
      selectionEligible: Boolean(profile?.selection_eligible),
    },
    stats: {
      trainingCount: Number(stats?.training_count ?? 0),
      matchCount: Number(stats?.match_count ?? 0),
      callupCount: Number(stats?.callup_count ?? 0),
    },
    matchHistory: matchHistory.map((match) => ({
      id: match.external_id,
      date: match.match_date,
      startTime: match.start_time,
      opponent: match.opponent,
      homeAway: match.home_away,
      sourceTeam: match.source_team,
      level: match.level == null ? null : Number(match.level),
    })),
    goals: goals.map((goal) => ({
      id: goal.id,
      slot: goal.slot,
      title: goal.title,
      evidenceHint: goal.evidence_hint,
      status: goal.status,
      startsOn: goal.starts_on,
      reviewOn: goal.review_on,
      endedOn: goal.ended_on,
    })),
    observations: observations.map((observation) => ({
      id: observation.id,
      activityId: observation.activity_id,
      activityDate: observation.activity_date,
      activityTitle: observation.activity_title,
      activityType: observation.activity_type,
      goalId: observation.goal_id,
      goalTitle: observation.goal_title,
      evidence: observation.evidence,
      note: observation.note,
      coachName: observation.coach_name,
      createdAt: observation.created_at,
    })),
  };
}

export async function createMobileDevelopmentGoal(
  actor: CurrentUser,
  playerId: number,
  input: { title: string; evidenceHint: string; reviewOn: string | null }
): Promise<MobilePlayerDetail> {
  requirePermission(actor, "manage_evaluations");
  if (!(await listMobilePlayers(actor)).some((player) => player.id === playerId)) {
    throw new DevelopmentServiceError("not_found", "Spelaren hittades inte.", 404);
  }
  const title = input.title.trim();
  const evidenceHint = input.evidenceHint.trim();
  const reviewOn = input.reviewOn?.trim() ?? "";
  if (title.length < 3 || title.length > 120 || evidenceHint.length > 240 || (reviewOn && !/^\d{4}-\d{2}-\d{2}$/.test(reviewOn))) {
    throw new DevelopmentServiceError("invalid", "Kontrollera måltext, ledtråd och uppföljningsdatum.", 400);
  }
  const rows = await run(
    `INSERT INTO player_development_goals
       (id, player_id, slot, title, evidence_hint, starts_on, review_on, created_by)
     SELECT ?, ?, slots.slot, ?, ?, to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD'), NULLIF(?, ''), ?
     FROM (VALUES (1), (2)) AS slots(slot)
     WHERE NOT EXISTS (
       SELECT 1 FROM player_development_goals existing
       WHERE existing.player_id = ? AND existing.status = 'active' AND existing.slot = slots.slot
     )
     ORDER BY slots.slot LIMIT 1 RETURNING id`,
    [crypto.randomUUID(), playerId, title, evidenceHint, reviewOn, actor.name, playerId]
  );
  if (rows.length === 0) throw new DevelopmentServiceError("invalid", "Spelaren har redan två aktiva mål.", 409);
  await logActivity(actor.name, "satte native-utvecklingsmål", `spelare ${playerId}`);
  return getMobilePlayer(actor, playerId);
}

export async function closeMobileDevelopmentGoal(
  actor: CurrentUser,
  playerId: number,
  goalId: string,
  status: "achieved" | "paused"
): Promise<MobilePlayerDetail> {
  requirePermission(actor, "manage_evaluations");
  if (!UUID_PATTERN.test(goalId) || !["achieved", "paused"].includes(status)) {
    throw new DevelopmentServiceError("invalid", "Ogiltigt mål eller status.", 400);
  }
  const summary = (await listMobilePlayers(actor)).find((player) => player.id === playerId);
  if (!summary) throw new DevelopmentServiceError("not_found", "Spelaren hittades inte.", 404);
  const updated = await run(
    `UPDATE player_development_goals
     SET status = ?, ended_on = to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD'),
         updated_at = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
     WHERE id = ? AND player_id = ? AND status = 'active' RETURNING id`,
    [status, goalId, playerId]
  );
  if (updated.length === 0) throw new DevelopmentServiceError("not_found", "Det aktiva målet hittades inte.", 404);
  await logActivity(actor.name, status === "achieved" ? "uppnådde native-utvecklingsmål" : "pausade native-utvecklingsmål", `spelare ${playerId}`);
  return getMobilePlayer(actor, playerId);
}

export async function updateMobilePlayerPreferences(
  actor: CurrentUser,
  playerId: number,
  input: {
    primaryPosition: string;
    secondaryPosition: string;
    primaryLevel: string;
    secondaryLevel: string;
    selectionEligible: boolean;
  }
): Promise<MobilePlayerDetail> {
  requirePermission(actor, "manage_squads");
  if (!(await listMobilePlayers(actor)).some((player) => player.id === playerId)) {
    throw new DevelopmentServiceError("not_found", "Spelaren hittades inte.", 404);
  }
  const positions = new Set(["", "Målvakt", "Back", "Mittfält", "Vänsterkant", "Högerkant", "Anfall"]);
  const levels = new Set(["", "2", "3", "4"]);
  if (!positions.has(input.primaryPosition) || !levels.has(input.primaryLevel) || !levels.has(input.secondaryLevel)) {
    throw new DevelopmentServiceError("invalid", "Ogiltig position eller Sanktan-nivå.", 400);
  }
  await run(
    `UPDATE players SET preferred_position_primary = ?,
                        preferred_level_primary = ?, preferred_level_secondary = ?,
                        level_assessed_at = now(), level_assessed_by = ?, selection_eligible = ?
     WHERE id = ?`,
    [
      input.primaryPosition,
      input.primaryLevel,
      input.secondaryLevel === input.primaryLevel ? "" : input.secondaryLevel,
      actor.name,
      input.selectionEligible ? 1 : 0,
      playerId,
    ]
  );
  return getMobilePlayer(actor, playerId);
}

export async function listMobileActivities(actor: CurrentUser): Promise<MobileActivity[]> {
  requirePermission(actor, "view_players");
  const scope = activityScope(actor);
  const rows = await all<{
    id: string;
    match_id: number | null;
    activity_date: string;
    start_time: string | null;
    activity_type: MobileActivity["type"];
    title: string;
    group_id: number | null;
    theme: string;
    challenge_context: MobileActivity["challengeContext"];
    observation_count: number;
    is_primary_match: boolean;
    source_team: string;
    match_level: MobileActivity["matchLevel"];
    loaned_player_names: string;
    finished: number;
    accepted_callup_count: number;
    declined_callup_count: number;
    pending_callup_count: number;
    squad_count: number;
    has_confirmed_squad: boolean;
    squad_player_names: string;
    accepted_player_names: string;
  }>(
    `SELECT da.id, da.match_id, da.activity_date, da.start_time, da.activity_type, da.title,
            da.group_id, da.theme, da.challenge_context,
            COUNT(o.id) AS observation_count,
            da.activity_type = 'match'
              AND EXISTS (SELECT 1 FROM groups g WHERE g.id = da.group_id AND g.name = 'Gul') AS is_primary_match,
            COALESCE(match_group.name, '') AS source_team,
            CASE
              WHEN linked_match.level IN ('1', 'extra_svar') THEN 'Extra svår'
              WHEN linked_match.level IN ('2', 'svar') THEN 'Svår'
              WHEN linked_match.level IN ('3', 'medel') THEN 'Medel'
              WHEN linked_match.level IN ('4', 'latt') THEN 'Lätt'
              WHEN linked_match.level IN ('5', 'extra_latt') THEN 'Extra lätt'
              ELSE 'Öppen klass'
            END AS match_level,
            COALESCE((
              SELECT string_agg(loaned.name, E'\\x1f' ORDER BY lower(loaned.name))
              FROM players loaned
              JOIN player_group_memberships loaned_membership
                ON loaned_membership.player_id = loaned.id AND loaned_membership.is_primary = 1
              JOIN groups loaned_group
                ON loaned_group.id = loaned_membership.group_id AND loaned_group.name = 'Gul'
              WHERE match_group.name = 'Grön'
                AND (
                  (COALESCE(linked_match.finished, 0) = 1 AND EXISTS (
                    SELECT 1 FROM match_players played
                    WHERE played.match_id = da.match_id AND played.player_id = loaned.id
                  ))
                  OR
                  (COALESCE(linked_match.finished, 0) = 0 AND (
                    EXISTS (
                      SELECT 1 FROM match_squad squad
                      WHERE squad.match_id = da.match_id AND squad.player_id = loaned.id
                    )
                    OR (
                      NOT EXISTS (SELECT 1 FROM match_squad saved_squad WHERE saved_squad.match_id = da.match_id)
                      AND (
                        EXISTS (
                          SELECT 1 FROM development_selection_decisions decision
                          WHERE decision.activity_id = da.id AND decision.player_id = loaned.id
                            AND decision.decision = 'selected'
                        )
                        OR EXISTS (
                          SELECT 1 FROM development_activity_callups callup
                          WHERE callup.activity_id = da.id AND callup.player_id = loaned.id
                            AND callup.attendance_status IN ('present', 'unknown')
                        )
                      )
                    )
                  ))
                )
            ), '') AS loaned_player_names,
            COALESCE((SELECT m.finished FROM matches m WHERE m.id = da.match_id), 0) AS finished,
            COALESCE((SELECT COUNT(*) FROM development_activity_callups c WHERE c.activity_id = da.id AND c.attendance_status = 'present'), 0) AS accepted_callup_count,
            COALESCE((SELECT COUNT(*) FROM development_activity_callups c WHERE c.activity_id = da.id AND c.attendance_status = 'absent'), 0) AS declined_callup_count,
            COALESCE((SELECT COUNT(*) FROM development_activity_callups c WHERE c.activity_id = da.id AND c.attendance_status = 'unknown'), 0) AS pending_callup_count,
            COALESCE((SELECT COUNT(*) FROM match_squad squad WHERE squad.match_id = da.match_id), 0) AS squad_count,
            (
              EXISTS (SELECT 1 FROM match_squad squad WHERE squad.match_id = da.match_id)
              OR EXISTS (SELECT 1 FROM development_selection_decisions decision WHERE decision.activity_id = da.id)
            ) AS has_confirmed_squad,
            COALESCE((
              SELECT string_agg(p.name, E'\\x1f' ORDER BY lower(p.name))
              FROM match_squad squad JOIN players p ON p.id = squad.player_id
              WHERE squad.match_id = da.match_id
            ), '') AS squad_player_names,
            COALESCE((
              SELECT string_agg(p.name, E'\\x1f' ORDER BY lower(p.name))
              FROM development_activity_callups callup JOIN players p ON p.id = callup.player_id
              WHERE callup.activity_id = da.id AND callup.attendance_status = 'present'
            ), '') AS accepted_player_names
     FROM development_activities da
     JOIN matches linked_match ON linked_match.id = da.match_id
     JOIN groups match_group ON match_group.id = da.group_id AND match_group.name IN ('Gul', 'Grön')
     LEFT JOIN development_observations o ON o.activity_id = da.id
     WHERE ${scope.sql}
       AND da.activity_type = 'match'
     GROUP BY da.id, match_group.name, linked_match.finished, linked_match.level
     ORDER BY da.activity_date DESC, da.start_time DESC NULLS LAST
     LIMIT 80`,
    scope.args
  );
  return rows.map((row) => ({
    id: row.id,
    matchId: row.match_id,
    date: row.activity_date,
    startTime: row.start_time,
    type: row.activity_type,
    title: row.title,
    groupId: row.group_id,
    theme: row.theme,
    challengeContext: row.challenge_context,
    observationCount: Number(row.observation_count),
    isPrimaryMatch: row.is_primary_match,
    sourceTeam: row.source_team,
    matchLevel: row.match_level,
    loanedPlayerNames: row.loaned_player_names ? row.loaned_player_names.split("\u001f") : [],
    finished: Boolean(row.finished),
    acceptedCallupCount: Number(row.accepted_callup_count),
    declinedCallupCount: Number(row.declined_callup_count),
    pendingCallupCount: Number(row.pending_callup_count),
    squadCount: Number(row.squad_count),
    hasConfirmedSquad: row.has_confirmed_squad,
    squadPlayerNames: row.squad_player_names ? row.squad_player_names.split("\u001f") : [],
    acceptedPlayerNames: row.accepted_player_names ? row.accepted_player_names.split("\u001f") : [],
  }));
}

export async function listMobileSelectionMatches(actor: CurrentUser): Promise<MobileSelectionMatch[]> {
  requirePermission(actor, "manage_squads");
  const scope = activityScope(actor);
  const rows = await all<{
    id: string;
    activity_date: string;
    start_time: string | null;
    title: string;
    source_team: string;
    competition_level: number | null;
    accepted_callup_count: number;
    declined_callup_count: number;
    pending_callup_count: number;
    squad_count: number;
    has_confirmed_squad: boolean;
  }>(
    `SELECT da.id, da.activity_date, da.start_time, da.title,
            COALESCE(g.name, '') AS source_team,
            CASE WHEN m.level ~ '^[0-9]+$' THEN m.level::integer END AS competition_level,
            COALESCE((SELECT COUNT(*) FROM development_activity_callups dac WHERE dac.activity_id = da.id AND dac.attendance_status = 'present'), 0) AS accepted_callup_count,
            COALESCE((SELECT COUNT(*) FROM development_activity_callups dac WHERE dac.activity_id = da.id AND dac.attendance_status = 'absent'), 0) AS declined_callup_count,
            COALESCE((SELECT COUNT(*) FROM development_activity_callups dac WHERE dac.activity_id = da.id AND dac.attendance_status = 'unknown'), 0) AS pending_callup_count,
            COALESCE((SELECT COUNT(*) FROM match_squad squad WHERE squad.match_id = m.id), 0) AS squad_count,
            (
              EXISTS (SELECT 1 FROM match_squad squad WHERE squad.match_id = m.id)
              OR EXISTS (SELECT 1 FROM development_selection_decisions decision WHERE decision.activity_id = da.id)
            ) AS has_confirmed_squad
     FROM development_activities da
     JOIN matches m ON m.id = da.match_id
     LEFT JOIN groups g ON g.id = da.group_id
     WHERE da.activity_type = 'match'
       AND da.activity_date >= to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD')
       AND g.name = 'Gul'
       AND ${scope.sql}
     ORDER BY da.activity_date, da.start_time NULLS LAST, da.id
     LIMIT 100`,
    scope.args
  );
  return rows.map((row) => ({
    id: row.id,
    date: row.activity_date,
    startTime: row.start_time,
    title: row.title,
    sourceTeam: row.source_team,
    competitionLevel: row.competition_level == null ? null : Number(row.competition_level),
    acceptedCallupCount: Number(row.accepted_callup_count),
    declinedCallupCount: Number(row.declined_callup_count),
    pendingCallupCount: Number(row.pending_callup_count),
    squadCount: Number(row.squad_count),
    hasConfirmedSquad: row.has_confirmed_squad,
    selectionCount: Number(row.squad_count),
  }));
}

export async function getMobileSelectionWorkspace(actor: CurrentUser, activityId: string): Promise<MobileSelectionWorkspace> {
  const match = (await listMobileSelectionMatches(actor)).find((item) => item.id === activityId);
  if (!match) throw new DevelopmentServiceError("not_found", "Uttagningen hittades inte.", 404);
  const scope = playerScope(actor);
  const rows = await all<{
    player_id: number;
    name: string;
    jersey_number: number | null;
    position: string;
    preferred_position_primary: string;
    preferred_position_secondary: string;
    preferred_level_primary: string;
    preferred_level_secondary: string;
    team_names: string[];
    saved_decision: MobileSelectionCandidate["decision"] | null;
    in_match_squad: boolean;
    callup_status: "present" | "absent" | "unknown" | null;
    selected_last_eight: number;
    selected_last_three: number;
    match_count: number;
    callup_count: number;
    planned_upcoming_count: number;
    window_match_count: number;
    last_selected_date: string | null;
  }>(
    `SELECT p.id AS player_id, p.name, p.jersey_number, p.position,
            p.preferred_position_primary, p.preferred_position_secondary,
            p.preferred_level_primary, p.preferred_level_secondary,
            ARRAY(SELECT g.name FROM player_group_memberships pgm JOIN groups g ON g.id = pgm.group_id WHERE pgm.player_id = p.id ORDER BY g.name) AS team_names,
            sd.decision AS saved_decision,
            ms.player_id IS NOT NULL AS in_match_squad,
            dac.attendance_status AS callup_status,
            (SELECT COUNT(*) FROM (
               SELECT history.id, EXISTS (
                 SELECT 1 FROM match_players history_player
                 WHERE history_player.match_id = history.id AND history_player.player_id = p.id
               ) AS played
               FROM matches history
               WHERE history.group_id = target.group_id
                 AND history.date <= ? AND history.id IS DISTINCT FROM target.match_id
                 AND history.finished = 1
               ORDER BY history.date DESC, history.start_time DESC NULLS LAST, history.id DESC LIMIT 8
             ) recent8 WHERE recent8.played) AS selected_last_eight,
            (SELECT COUNT(*) FROM (
               SELECT history.id, EXISTS (
                 SELECT 1 FROM match_players history_player
                 WHERE history_player.match_id = history.id AND history_player.player_id = p.id
               ) AS played
               FROM matches history
               WHERE history.group_id = target.group_id
                 AND history.date <= ? AND history.id IS DISTINCT FROM target.match_id
                 AND history.finished = 1
               ORDER BY history.date DESC, history.start_time DESC NULLS LAST, history.id DESC LIMIT 3
             ) recent3 WHERE recent3.played) AS selected_last_three,
            (SELECT COUNT(DISTINCT played_mp.match_id)
             FROM match_players played_mp
             WHERE played_mp.player_id = p.id) AS match_count,
            (SELECT COUNT(*) FROM development_activity_callups ac WHERE ac.player_id = p.id) AS callup_count,
            (SELECT COUNT(*) FROM development_selection_decisions future_sd JOIN development_activities future_da ON future_da.id = future_sd.activity_id WHERE future_sd.player_id = p.id AND future_sd.decision = 'selected' AND future_da.activity_date >= ? AND future_da.id <> ?) AS planned_upcoming_count,
            (SELECT COUNT(DISTINCT window_match.id)
             FROM matches window_match
             WHERE window_match.date::date BETWEEN (target.activity_date::date - INTERVAL '7 days') AND (target.activity_date::date + INTERVAL '7 days')
               AND (
                 EXISTS (SELECT 1 FROM match_players played WHERE played.match_id = window_match.id AND played.player_id = p.id)
                 OR EXISTS (SELECT 1 FROM match_squad squad WHERE squad.match_id = window_match.id AND squad.player_id = p.id)
                 OR EXISTS (
                   SELECT 1 FROM development_activities window_activity
                   JOIN development_selection_decisions window_selection ON window_selection.activity_id = window_activity.id
                   WHERE window_activity.match_id = window_match.id AND window_selection.player_id = p.id AND window_selection.decision = 'selected'
                 )
                 OR EXISTS (
                   SELECT 1 FROM development_activities window_activity
                   JOIN development_activity_callups window_callup ON window_callup.activity_id = window_activity.id
                   WHERE window_activity.match_id = window_match.id AND window_callup.player_id = p.id AND window_callup.attendance_status <> 'absent'
                 )
               )) AS window_match_count,
            (SELECT MAX(history.date)
             FROM match_players history_player
             JOIN matches history ON history.id = history_player.match_id
             WHERE history_player.player_id = p.id AND history.date <= ? AND history.finished = 1) AS last_selected_date
     FROM players p
     LEFT JOIN development_selection_decisions sd ON sd.activity_id = ? AND sd.player_id = p.id
     LEFT JOIN development_activity_callups dac ON dac.activity_id = ? AND dac.player_id = p.id
     LEFT JOIN development_activities target ON target.id = ?
     LEFT JOIN match_squad ms ON ms.match_id = target.match_id AND ms.player_id = p.id
     WHERE p.active = 1 AND p.selection_eligible = 1 AND ${scope.sql}
     ORDER BY CASE
       WHEN 'Gul' = ANY(ARRAY(SELECT g.name FROM player_group_memberships pgm JOIN groups g ON g.id = pgm.group_id WHERE pgm.player_id = p.id)) THEN 0
       WHEN 'F15' = ANY(ARRAY(SELECT g.name FROM player_group_memberships pgm JOIN groups g ON g.id = pgm.group_id WHERE pgm.player_id = p.id)) THEN 1
       WHEN 'Grön' = ANY(ARRAY(SELECT g.name FROM player_group_memberships pgm JOIN groups g ON g.id = pgm.group_id WHERE pgm.player_id = p.id)) THEN 2
       ELSE 3 END, lower(p.name)`,
    [match.date, match.date, match.date, activityId, match.date, activityId, activityId, activityId, ...scope.args]
  );
  const hasSavedSquad = rows.some((row) => row.in_match_squad);
  return {
    match,
    candidates: rows.map((row) => {
      const currentCallupStatus = row.callup_status === "present" ? "accepted"
        : row.callup_status === "absent" ? "declined"
        : row.callup_status === "unknown" ? "pending" : null;
      return {
        playerId: row.player_id,
        name: row.name,
        jerseyNumber: row.jersey_number,
        position: row.position,
        primaryPosition: row.preferred_position_primary,
        secondaryPosition: row.preferred_position_secondary,
        primaryLevel: row.preferred_level_primary,
        secondaryLevel: row.preferred_level_secondary,
        teamNames: row.team_names ?? [],
        decision: hasSavedSquad
          ? (row.in_match_squad ? "selected" : (row.saved_decision === "reserve" ? "reserve" : "rested"))
          : (currentCallupStatus === "accepted" ? "selected" : (row.saved_decision ?? "rested")),
        currentCallupStatus,
        selectedLastEight: Number(row.selected_last_eight),
        selectedLastThree: Number(row.selected_last_three),
        matchCount: Number(row.match_count),
        callupCount: Number(row.callup_count),
        plannedUpcomingCount: Number(row.planned_upcoming_count),
        windowMatchCount: Number(row.window_match_count),
        lastSelectedDate: row.last_selected_date,
      };
    }),
  };
}

export async function saveMobileSelection(
  actor: CurrentUser,
  activityId: string,
  decisions: MobileSelectionDecision[]
): Promise<MobileSelectionWorkspace> {
  requirePermission(actor, "manage_squads");
  const workspace = await getMobileSelectionWorkspace(actor, activityId);
  const candidateIds = new Set(workspace.candidates.map((candidate) => candidate.playerId));
  const byPlayer = new Map<number, MobileSelectionDecision>();
  for (const decision of decisions) {
    if (!candidateIds.has(decision.playerId) || byPlayer.has(decision.playerId) || !["selected", "reserve", "rested"].includes(decision.decision)) {
      throw new DevelopmentServiceError("invalid", "Uttagningen innehåller ogiltiga spelare eller beslut.", 400);
    }
    const position = decision.position.trim();
    if (position.length > 40) throw new DevelopmentServiceError("invalid", "Positionen är för lång.", 400);
    byPlayer.set(decision.playerId, { ...decision, position });
  }
  const activity = await get<{ match_id: number | null }>("SELECT match_id FROM development_activities WHERE id = ?", [activityId]);
  const statements: { sql: string; args: SqlArgs }[] = [];
  if (activity?.match_id != null) {
    statements.push({ sql: "DELETE FROM match_squad WHERE match_id = ?", args: [activity.match_id] });
  }
  for (const candidate of workspace.candidates) {
    const input = byPlayer.get(candidate.playerId) ?? {
      playerId: candidate.playerId,
      decision: "rested" as const,
      position: candidate.primaryPosition || candidate.position,
    };
    if (activity?.match_id != null && input.decision === "selected") {
      statements.push({ sql: "INSERT INTO match_squad (match_id, player_id) VALUES (?, ?) ON CONFLICT DO NOTHING", args: [activity.match_id, input.playerId] });
    }
    statements.push({
      sql: `INSERT INTO development_selection_decisions (activity_id, player_id, decision, decided_by)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (activity_id, player_id) DO UPDATE SET decision = excluded.decision, rationale = '', decided_by = excluded.decided_by, decided_at = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')`,
      args: [activityId, input.playerId, input.decision, actor.name],
    });
  }
  await batch(statements);
  await logActivity(actor.name, "sparade native-uttagning", `${[...byPlayer.values()].filter((item) => item.decision === "selected").length} uttagna`);
  return getMobileSelectionWorkspace(actor, activityId);
}

function validateCommand(command: CreateObservationCommand): CreateObservationCommand {
  const note = command.note.trim();
  if (!UUID_PATTERN.test(command.commandId) || !UUID_PATTERN.test(command.goalId)) {
    throw new DevelopmentServiceError("invalid", "Kommando- och mål-id måste vara UUID.", 400);
  }
  if (!Number.isInteger(command.playerId) || command.playerId < 1 || !EVIDENCE_VALUES.has(command.evidence)) {
    throw new DevelopmentServiceError("invalid", "Observationen innehåller ogiltiga värden.", 400);
  }
  if (note.length > 280) throw new DevelopmentServiceError("invalid", "Anteckningen får vara högst 280 tecken.", 400);
  return { ...command, note };
}

export async function createDevelopmentObservations(
  actor: CurrentUser,
  activityId: string,
  commands: CreateObservationCommand[],
  options: { skipInvalid?: boolean; durationSeconds?: number | null } = {}
): Promise<ObservationCommandResult[]> {
  requirePermission(actor, "manage_evaluations");
  if (!activityId || commands.length > 50) {
    throw new DevelopmentServiceError("invalid", "Aktivitet saknas eller för många observationer skickades.", 400);
  }
  const aScope = activityScope(actor);
  const activity = await get<{ id: string }>(
    `SELECT da.id FROM development_activities da WHERE da.id = ? AND ${aScope.sql}`,
    [activityId, ...aScope.args]
  );
  if (!activity) throw new DevelopmentServiceError("not_found", "Aktiviteten hittades inte.", 404);

  const results: ObservationCommandResult[] = [];
  let createdCount = 0;
  for (const rawCommand of commands) {
    let command: CreateObservationCommand;
    try {
      command = validateCommand(rawCommand);
      const pScope = playerScope(actor);
      const goal = await get<{ id: string }>(
        `SELECT g.id
         FROM player_development_goals g
         JOIN players p ON p.id = g.player_id AND p.active = 1
         WHERE g.id = ? AND g.player_id = ? AND g.status = 'active'
           AND (
             ${pScope.sql}
             OR EXISTS (
               SELECT 1 FROM development_selection_decisions sd
               WHERE sd.activity_id = ? AND sd.player_id = p.id AND sd.decision = 'selected'
             )
             OR EXISTS (
               SELECT 1 FROM development_activity_participation dap
               WHERE dap.activity_id = ? AND dap.player_id = p.id AND dap.selected = 1
             )
             OR EXISTS (
               SELECT 1 FROM development_activity_callups dac
               WHERE dac.activity_id = ? AND dac.player_id = p.id AND dac.attendance_status = 'present'
             )
             OR EXISTS (
               SELECT 1
               FROM development_activities da
               JOIN match_squad ms ON ms.match_id = da.match_id
               WHERE da.id = ? AND ms.player_id = p.id
             )
           )`,
        [command.goalId, command.playerId, ...pScope.args, activityId, activityId, activityId, activityId]
      );
      if (!goal) throw new DevelopmentServiceError("not_found", "Aktivt mål eller spelare hittades inte.", 404);

      const existing = await get<{
        id: string;
        activity_id: string;
        player_id: number;
        goal_id: string;
        evidence: MobileEvidence;
        note: string;
      }>(
        `SELECT id, activity_id, player_id, goal_id, evidence, note
         FROM development_observations WHERE id = ?`,
        [command.commandId]
      );
      if (existing) {
        if (
          existing.activity_id !== activityId
          || existing.player_id !== command.playerId
          || existing.goal_id !== command.goalId
          || existing.evidence !== command.evidence
          || existing.note !== command.note
        ) {
          throw new DevelopmentServiceError(
            "idempotency_conflict",
            "Kommando-id har redan använts med ett annat innehåll.",
            409
          );
        }
        results.push({ commandId: command.commandId, observationId: existing.id, status: "replayed" });
        continue;
      }

      const inserted = await run(
        `INSERT INTO development_observations
           (id, activity_id, player_id, goal_id, evidence, note, coach_name)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [command.commandId, activityId, command.playerId, command.goalId, command.evidence, command.note, actor.name]
      );
      if (inserted.length === 0) {
        throw new DevelopmentServiceError("idempotency_conflict", "Kommando-id kunde inte återspelas säkert.", 409);
      }
      createdCount += 1;
      results.push({ commandId: command.commandId, observationId: command.commandId, status: "created" });
    } catch (error) {
      if (options.skipInvalid && error instanceof DevelopmentServiceError && error.code !== "idempotency_conflict") continue;
      throw error;
    }
  }

  if (createdCount > 0) {
    await run(
      `INSERT INTO development_pilot_events
         (id, event_type, activity_id, duration_seconds, item_count, actor)
       VALUES (?, 'observation_saved', ?, ?, ?, ?)`,
      [crypto.randomUUID(), activityId, options.durationSeconds ?? null, createdCount, actor.name]
    );
    await logActivity(actor.name, "sparade utvecklingsobservationer", `${createdCount} observationer`);
  }
  return results;
}
