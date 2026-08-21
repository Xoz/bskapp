"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { batch, get, logActivity, run } from "./db";
import {
  canAccessGroup,
  canAccessPlayer,
  getCoachName,
  getCurrentUser,
  hasPermission,
  type Permission,
} from "./auth";
import { getPlayers } from "./queries";
import { swedishToday } from "./dates";
import { createDevelopmentObservations, type CreateObservationCommand } from "./services/development";
import { syncDevelopmentSourceRows } from "./developmentSync";

const EVIDENCE_VALUES = ["shown", "practicing", "revisit"] as const;
const CHALLENGE_VALUES = ["safe", "balanced", "challenging"] as const;
const GOAL_STATUS_VALUES = ["achieved", "paused"] as const;
const POSITION_VALUES = ["", "Målvakt", "Back", "Mittfält", "Vänsterkant", "Högerkant", "Anfall"] as const;
const SANKTAN_LEVEL_VALUES = ["", "2", "3", "4"] as const;

function enumValue<T extends string>(value: FormDataEntryValue | null, values: readonly T[]): T | null {
  const candidate = String(value ?? "") as T;
  return values.includes(candidate) ? candidate : null;
}

function validDateOrEmpty(value: string): boolean {
  return value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function requireCorePermission(permission: Permission): Promise<void> {
  if (!(await hasPermission(permission))) redirect("/idag?behorighet=saknas");
}

async function requireActivity(activityId: string) {
  const activity = await get<{
    id: string;
    activity_type: "training" | "match" | "other";
    group_id: number | null;
    match_id: number | null;
    external_source: string;
    activity_date: string;
  }>("SELECT id, activity_type, group_id, match_id, external_source, activity_date FROM development_activities WHERE id = ?", [activityId]);
  if (!activity || !(await canAccessGroup(activity.group_id))) redirect("/idag?behorighet=saknas");
  return activity;
}

function measuredSeconds(formData: FormData): number | null {
  const startedAt = Number(formData.get("opened_at_ms"));
  if (!Number.isFinite(startedAt) || startedAt <= 0) return null;
  const seconds = Math.round((Date.now() - startedAt) / 1000);
  return seconds >= 0 && seconds <= 60 * 60 ? seconds : null;
}

async function pilotEvent(
  eventType: "source_sync" | "goal_saved" | "observation_saved" | "selection_saved",
  actor: string,
  activityId: string | null,
  durationSeconds: number | null,
  itemCount: number
) {
  await run(
    `INSERT INTO development_pilot_events
       (id, event_type, activity_id, duration_seconds, item_count, actor)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), eventType, activityId, durationSeconds, itemCount, actor]
  );
}

export async function syncDevelopmentSources() {
  await requireCorePermission("manage_evaluations");
  const actor = (await getCoachName()) ?? "Tränare";

  await run(`
    INSERT INTO development_activities (
      id, activity_date, start_time, activity_type, title,
      external_source, external_key, match_id, group_id
    )
    SELECT
      'match-' || m.id::text,
      m.date,
      m.start_time,
      'match',
      CASE WHEN m.home_away = 'away' THEN 'Borta mot ' ELSE 'Hemma mot ' END || m.opponent,
      COALESCE(NULLIF(m.source, ''), 'match'),
      'match:' || m.id::text,
      m.id,
      m.group_id
    FROM matches m
    ON CONFLICT (external_key) DO UPDATE SET
      activity_date = excluded.activity_date,
      start_time = excluded.start_time,
      title = excluded.title,
      group_id = excluded.group_id,
      updated_at = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
  `);
  await run(`
    INSERT INTO development_activities (
      id, activity_date, start_time, activity_type, title,
      external_source, external_key
    )
    SELECT
      'svenskalag-' || md5(concat_ws('|', ae.activity_date, ae.start_time, ae.title, ae.category)),
      ae.activity_date,
      MIN(ae.start_time),
      CASE WHEN ae.category = 'training' THEN 'training'
           WHEN ae.category = 'match' THEN 'match'
           ELSE 'other' END,
      COALESCE(NULLIF(MAX(ae.title), ''), 'Aktivitet'),
      'svenskalag_attendance',
      'svenskalag:' || md5(concat_ws('|', ae.activity_date, ae.start_time, ae.title, ae.category))
    FROM attendance_events ae
    WHERE ae.import_id = (SELECT id FROM attendance_imports ORDER BY id DESC LIMIT 1)
      AND ae.activity_date IS NOT NULL
    GROUP BY ae.activity_date, ae.start_time, ae.title, ae.category
    ON CONFLICT (external_key) DO UPDATE SET
      activity_date = excluded.activity_date,
      start_time = excluded.start_time,
      activity_type = excluded.activity_type,
      title = excluded.title,
      updated_at = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
  `);
  await run(`
    INSERT INTO development_activity_participation (
      activity_id, player_id, attendance_status, source
    )
    SELECT
      da.id,
      ae.player_id,
      CASE WHEN MAX(ae.present) = 1 THEN 'present' ELSE 'absent' END,
      'svenskalag_attendance'
    FROM attendance_events ae
    JOIN development_activities da
      ON da.external_key = 'svenskalag:' || md5(concat_ws('|', ae.activity_date, ae.start_time, ae.title, ae.category))
    WHERE ae.import_id = (SELECT id FROM attendance_imports ORDER BY id DESC LIMIT 1)
      AND ae.player_id IS NOT NULL
    GROUP BY da.id, ae.player_id
    ON CONFLICT (activity_id, player_id) DO UPDATE SET
      attendance_status = excluded.attendance_status,
      source = excluded.source,
      updated_at = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
  `);
  await run(`
    INSERT INTO development_activity_participation (
      activity_id, player_id, attendance_status, selected, periods_played, source
    )
    SELECT da.id, mp.player_id, 'present', 1, 0, 'legacy_match'
    FROM match_players mp
    JOIN development_activities da ON da.match_id = mp.match_id
    ON CONFLICT (activity_id, player_id) DO UPDATE SET
      attendance_status = 'present',
      selected = 1,
      source = CASE
        WHEN development_activity_participation.source = 'manual' THEN development_activity_participation.source
        ELSE excluded.source
      END,
      updated_at = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
  `);

  // Samma normalisering används av filimporten och den manuella synkknappen.
  await syncDevelopmentSourceRows();

  await pilotEvent("source_sync", actor, null, null, 1);
  await logActivity(actor, "synkade utvecklingskällor", "Svenska Lag och matchreferenser");
  revalidatePath("/idag");
  revalidatePath("/observera");
  revalidatePath("/uttagning");
}

export async function saveActivityContext(activityId: string, formData: FormData) {
  await requireCorePermission("manage_evaluations");
  await requireActivity(activityId);
  const theme = String(formData.get("theme") ?? "").trim().slice(0, 120);
  const challenge = enumValue(formData.get("challenge_context"), CHALLENGE_VALUES);
  await run(
    `UPDATE development_activities
     SET theme = ?, challenge_context = ?, updated_at = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
     WHERE id = ?`,
    [theme, challenge ?? "balanced", activityId]
  );
  revalidatePath(`/observera?aktivitet=${encodeURIComponent(activityId)}`);
  revalidatePath("/idag");
}

export async function createDevelopmentGoal(playerId: number, formData: FormData) {
  await requireCorePermission("manage_evaluations");
  if (!(await canAccessPlayer(playerId))) redirect("/idag?behorighet=saknas");
  const title = String(formData.get("title") ?? "").trim();
  const evidenceHint = String(formData.get("evidence_hint") ?? "").trim();
  const reviewOn = String(formData.get("review_on") ?? "").trim();
  if (title.length < 3 || title.length > 120 || evidenceHint.length > 240 || !validDateOrEmpty(reviewOn)) {
    redirect(`/spelare/${playerId}?mal=ogiltigt`);
  }
  const actor = (await getCoachName()) ?? "Tränare";
  const id = crypto.randomUUID();
  const rows = await run(
    `INSERT INTO player_development_goals
       (id, player_id, slot, title, evidence_hint, starts_on, review_on, created_by)
     SELECT ?, ?, slots.slot, ?, ?, ?, NULLIF(?, ''), ?
     FROM (VALUES (1), (2)) AS slots(slot)
     WHERE NOT EXISTS (
       SELECT 1 FROM player_development_goals existing
       WHERE existing.player_id = ? AND existing.status = 'active' AND existing.slot = slots.slot
     )
     ORDER BY slots.slot
     LIMIT 1
     RETURNING id`,
    [
      id,
      playerId,
      title,
      evidenceHint,
      swedishToday(),
      reviewOn,
      actor,
      playerId,
    ]
  );
  if (rows.length === 0) redirect(`/spelare/${playerId}?mal=max`);
  await pilotEvent("goal_saved", actor, null, measuredSeconds(formData), 1);
  await logActivity(actor, "satte utvecklingsmål", `spelare ${playerId}`);
  revalidatePath(`/spelare/${playerId}`);
  revalidatePath("/spelare");
  revalidatePath("/idag");
  redirect(`/spelare/${playerId}`);
}

export async function closeDevelopmentGoal(goalId: string, formData: FormData) {
  await requireCorePermission("manage_evaluations");
  const goal = await get<{ player_id: number }>(
    "SELECT player_id FROM player_development_goals WHERE id = ? AND status = 'active'",
    [goalId]
  );
  if (!goal || !(await canAccessPlayer(goal.player_id))) redirect("/idag?behorighet=saknas");
  const status = enumValue(formData.get("status"), GOAL_STATUS_VALUES);
  if (!status) return;
  await run(
    `UPDATE player_development_goals
     SET status = ?, ended_on = ?, updated_at = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
     WHERE id = ? AND status = 'active'`,
    [status, swedishToday(), goalId]
  );
  revalidatePath(`/spelare/${goal.player_id}`);
  revalidatePath("/spelare");
  revalidatePath("/idag");
}

export async function saveQuickObservations(activityId: string, formData: FormData) {
  await requireCorePermission("manage_evaluations");
  await requireActivity(activityId);
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  const commands: CreateObservationCommand[] = [];

  for (const [key, rawEvidence] of formData.entries()) {
    if (!key.startsWith("evidence_")) continue;
    const playerId = Number(key.slice("evidence_".length));
    const evidence = enumValue(rawEvidence, EVIDENCE_VALUES);
    if (!Number.isInteger(playerId) || !evidence || !(await canAccessPlayer(playerId))) continue;
    const goalId = String(formData.get(`goal_${playerId}`) ?? "");
    const note = String(formData.get(`note_${playerId}`) ?? "").trim().slice(0, 280);
    commands.push({
      commandId: crypto.randomUUID(),
      playerId,
      goalId,
      evidence,
      note,
    });
  }

  await createDevelopmentObservations(actor, activityId, commands, {
    skipInvalid: true,
    durationSeconds: measuredSeconds(formData),
  });
  revalidatePath(`/observera?aktivitet=${encodeURIComponent(activityId)}`);
  revalidatePath("/idag");
  revalidatePath("/spelare");
}

export async function saveDevelopmentSelection(activityId: string, formData: FormData) {
  await requireCorePermission("manage_squads");
  const activity = await requireActivity(activityId);
  if (
    activity.activity_type !== "match"
    || activity.external_source !== "svenskalag_sanktan"
    || activity.activity_date < swedishToday()
  ) redirect("/uttagning?aktivitet=ogiltig");
  const actor = (await getCoachName()) ?? "Tränare";
  const accessiblePlayers = await getPlayers();
  const accessibleIds = new Set(accessiblePlayers.map((player) => player.id));
  const selected = new Set(formData.getAll("selected_player").map(Number).filter((id) => accessibleIds.has(id)));
  const reserves = new Set(formData.getAll("reserve_player").map(Number).filter((id) => accessibleIds.has(id)));
  const statements: { sql: string; args: (string | number | null)[] }[] = [];

  if (activity.match_id != null) {
    statements.push({ sql: "DELETE FROM match_squad WHERE match_id = ?", args: [activity.match_id] });
    for (const playerId of selected) {
      statements.push({
        sql: "INSERT INTO match_squad (match_id, player_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
        args: [activity.match_id, playerId],
      });
    }
  }

  for (const player of accessiblePlayers) {
    const decision = selected.has(player.id) ? "selected" : reserves.has(player.id) ? "reserve" : "rested";
    const position = String(formData.get(`position_${player.id}`) ?? player.position ?? "").trim().slice(0, 40);
    statements.push({
      sql: `INSERT INTO development_selection_decisions
              (activity_id, player_id, decision, decided_by)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (activity_id, player_id) DO UPDATE SET
              decision = excluded.decision,
              rationale = '',
              decided_by = excluded.decided_by,
              decided_at = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')`,
      args: [activityId, player.id, decision, actor],
    });
    statements.push({
      sql: `INSERT INTO development_activity_participation
              (activity_id, player_id, attendance_status, selected, position, source)
            VALUES (?, ?, 'unknown', ?, ?, 'manual')
            ON CONFLICT (activity_id, player_id) DO UPDATE SET
              selected = excluded.selected,
              position = excluded.position,
              source = 'manual',
              updated_at = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')`,
      args: [activityId, player.id, decision === "selected" ? 1 : 0, position],
    });
  }

  await batch(statements);
  await pilotEvent("selection_saved", actor, activityId, measuredSeconds(formData), selected.size);
  await logActivity(actor, "sparade utvecklingsuttagning", `${selected.size} uttagna`);
  revalidatePath(`/uttagning?aktivitet=${encodeURIComponent(activityId)}`);
  if (activity.match_id != null) revalidatePath(`/matcher/${activity.match_id}/utvardera`);
  revalidatePath("/idag");
}

export async function savePlayerSelectionPreferences(playerId: number, formData: FormData) {
  await requireCorePermission("manage_squads");
  if (!(await canAccessPlayer(playerId))) redirect("/spelare");
  const primaryPosition = enumValue(formData.get("preferred_position_primary"), POSITION_VALUES);
  const primaryLevel = enumValue(formData.get("preferred_level_primary"), SANKTAN_LEVEL_VALUES);
  const secondaryLevel = enumValue(formData.get("preferred_level_secondary"), SANKTAN_LEVEL_VALUES);
  const selectionEligible = formData.get("selection_eligible") === "1" ? 1 : 0;
  if (primaryPosition === null || primaryLevel === null || secondaryLevel === null) return;
  const assessedBy = (await getCoachName()) ?? "Tränare";

  await run(
    `UPDATE players
     SET preferred_position_primary = ?,
         preferred_level_primary = ?, preferred_level_secondary = ?,
         level_assessed_at = now(), level_assessed_by = ?,
         selection_eligible = ?
     WHERE id = ?`,
    [
      primaryPosition,
      primaryLevel,
      secondaryLevel === primaryLevel ? "" : secondaryLevel,
      assessedBy,
      selectionEligible,
      playerId,
    ]
  );
  revalidatePath(`/spelare/${playerId}`);
  revalidatePath("/uttagning");
}
