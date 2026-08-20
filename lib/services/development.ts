import "server-only";

import crypto from "crypto";
import type { CurrentUser, Permission } from "../auth";
import { all, get, logActivity, run, type SqlArgs } from "../db";

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

export type MobileActivity = {
  id: string;
  date: string;
  startTime: string | null;
  type: "training" | "match" | "other";
  title: string;
  groupId: number | null;
  theme: string;
  challengeContext: "safe" | "balanced" | "challenging";
  observationCount: number;
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

export async function getMobilePlayer(actor: CurrentUser, playerId: number): Promise<MobilePlayerDetail> {
  if (!Number.isInteger(playerId) || playerId < 1) {
    throw new DevelopmentServiceError("invalid", "Ogiltigt spelar-id.", 400);
  }
  const summary = (await listMobilePlayers(actor)).find((player) => player.id === playerId);
  if (!summary) throw new DevelopmentServiceError("not_found", "Spelaren hittades inte.", 404);
  const [goals, observations] = await Promise.all([
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

export async function listMobileActivities(actor: CurrentUser): Promise<MobileActivity[]> {
  requirePermission(actor, "view_players");
  const scope = activityScope(actor);
  const rows = await all<{
    id: string;
    activity_date: string;
    start_time: string | null;
    activity_type: MobileActivity["type"];
    title: string;
    group_id: number | null;
    theme: string;
    challenge_context: MobileActivity["challengeContext"];
    observation_count: number;
  }>(
    `SELECT da.id, da.activity_date, da.start_time, da.activity_type, da.title,
            da.group_id, da.theme, da.challenge_context,
            COUNT(o.id) AS observation_count
     FROM development_activities da
     LEFT JOIN development_observations o ON o.activity_id = da.id
     WHERE ${scope.sql}
     GROUP BY da.id
     ORDER BY da.activity_date DESC, da.start_time DESC NULLS LAST
     LIMIT 80`,
    scope.args
  );
  return rows.map((row) => ({
    id: row.id,
    date: row.activity_date,
    startTime: row.start_time,
    type: row.activity_type,
    title: row.title,
    groupId: row.group_id,
    theme: row.theme,
    challengeContext: row.challenge_context,
    observationCount: Number(row.observation_count),
  }));
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
         WHERE g.id = ? AND g.player_id = ? AND g.status = 'active' AND ${pScope.sql}`,
        [command.goalId, command.playerId, ...pScope.args]
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
