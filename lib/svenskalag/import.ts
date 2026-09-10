import type postgres from "postgres";
import { nameKey, validateSnapshot, type ActivitySnapshot } from "./model";

/** Hela hämtningen valideras före transaktionen. Inga schemaändringar i arbetaren. */
export async function applySnapshot(sql: ReturnType<typeof postgres>, items: ActivitySnapshot[], today: string, dryRun = false) {
  validateSnapshot(items, today);
  return sql.begin(async tx => {
    const groups = await tx`SELECT id FROM groups WHERE name = 'Gul' AND group_type = 'subgroup' AND active = 1`;
    if (groups.length !== 1) throw new Error("Gul måste vara entydigt kopplat");
    const groupId = groups[0].id;
    const players = await tx`SELECT id, name FROM players WHERE active = 1`;
    const names = new Map<string, number[]>();
    for (const p of players) names.set(nameKey(p.name), [...(names.get(nameKey(p.name)) ?? []), p.id]);
    const unmatched: string[] = [];
    let activities = 0;
    for (const a of items) {
      const key = a.kind === "match" ? `sanktan:${a.sourceId}` : `svenskalag:activity:${a.sourceId}`;
      let rows = Array.from(await tx`SELECT id, match_id FROM development_activities WHERE external_key = ${key} AND group_id = ${groupId}`);
      // Match-id kommer från källan; vi gissar aldrig på motståndare eller datum.
      if (a.kind === "match" && (rows.length !== 1 || rows[0].match_id == null)) { unmatched.push(`Match ${a.sourceId} saknar koppling`); continue; }
      if (a.kind === "match" && (await tx`SELECT id FROM matches WHERE id = ${rows[0].match_id} AND group_id = ${groupId}`).length !== 1) { unmatched.push(`Match ${a.sourceId}: lagkoppling behöver granskas`); continue; }
      const legacy = a.kind === "training" && rows.length === 0 ? await tx`SELECT id, match_id, external_source, title FROM development_activities WHERE group_id = ${groupId} AND activity_type = 'training' AND activity_date = ${a.date} AND start_time = ${a.time}` : [];
      if (legacy.length > 1 || (legacy.length === 1 && (legacy[0].external_source !== "svenskalag_file" || nameKey(legacy[0].title) !== nameKey(a.title)))) { unmatched.push(`Träning ${a.sourceId}: befintlig aktivitet behöver kopplas`); continue; }
      const callups: {id: number; status: string}[] = [];
      const attendance: number[] = [];
      let ambiguous = false;
      for (const p of a.callups) {
        const ids = names.get(nameKey(p.name)) ?? [];
        if (ids.length !== 1) { ambiguous = true; break; }
        callups.push({id: ids[0], status: p.status});
      }
      for (const name of a.attendance ?? []) {
        const ids = names.get(nameKey(name)) ?? [];
        if (ids.length !== 1) { ambiguous = true; break; }
        attendance.push(ids[0]);
      }
      if (ambiguous) { unmatched.push(`Aktivitet ${a.sourceId}: spelarkoppling behöver granskas`); continue; }
      activities++;
      if (dryRun) continue;
      if (a.kind === "training" && rows.length === 0) {
        // En äldre export kan redan ha skapat passet: kräver entydig matchning.
        if (legacy.length === 1) {
          rows = legacy;
          await tx`UPDATE development_activities SET external_key = ${key}, external_source = 'svenskalag_browser' WHERE id = ${rows[0].id}`;
        } else {
          rows = await tx`INSERT INTO development_activities (id, external_key, external_source, group_id, activity_type, activity_date, start_time, title)
            VALUES (${`svenskalag-activity-${a.sourceId}`}, ${key}, 'svenskalag_browser', ${groupId}, 'training', ${a.date}, ${a.time}, ${a.title}) RETURNING id, match_id`;
        }
      }
      const activity = rows[0];
      if (a.kind === "match") {
        const matchId = activity.match_id;
        // Uttagning, positioner och coachens källa lämnas intakta.
        await tx`UPDATE match_roster SET callup_status = NULL, updated_at = now() WHERE match_id = ${matchId}`;
        for (const p of callups) await tx`INSERT INTO match_roster (match_id, player_id, callup_status, source)
          VALUES (${matchId}, ${p.id}, ${p.status}, 'svenskalag_browser') ON CONFLICT (match_id, player_id)
          DO UPDATE SET callup_status = excluded.callup_status, updated_at = now()`;
        await tx`UPDATE matches SET callup_accepted_count = ${a.totals.accepted}, callup_declined_count = ${a.totals.declined}, callup_pending_count = ${a.totals.pending}, callup_source = 'svenskalag_browser' WHERE id = ${matchId} AND group_id = ${groupId}`;
      } else {
        await tx`UPDATE development_activities SET activity_date = ${a.date}, start_time = ${a.time}, title = ${a.title} WHERE id = ${activity.id}`;
        await tx`DELETE FROM development_activity_callups WHERE activity_id = ${activity.id}`;
        for (const p of callups) await tx`INSERT INTO development_activity_callups (activity_id, player_id, attendance_status) VALUES (${activity.id}, ${p.id}, ${p.status === 'accepted' ? 'present' : p.status === 'declined' ? 'absent' : 'unknown'})`;
        await tx`INSERT INTO development_activity_callup_summaries (activity_id, accepted_count, declined_count, pending_count, source)
          VALUES (${activity.id}, ${a.totals.accepted}, ${a.totals.declined}, ${a.totals.pending}, 'svenskalag_browser') ON CONFLICT (activity_id)
          DO UPDATE SET accepted_count = excluded.accepted_count, declined_count = excluded.declined_count, pending_count = excluded.pending_count, source = excluded.source, updated_at = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')`;
      }
      if (a.attendance !== null) {
        // Korrigera endast deltagande som denna synk äger; radera aldrig matchstatistik.
        await tx`UPDATE development_activity_participation SET attendance_status = 'absent' WHERE activity_id = ${activity.id} AND source = 'svenskalag_browser'`;
        for (const id of attendance) await tx`INSERT INTO development_activity_participation (activity_id, player_id, attendance_status, source)
          VALUES (${activity.id}, ${id}, 'present', 'svenskalag_browser') ON CONFLICT (activity_id, player_id) DO UPDATE SET attendance_status = excluded.attendance_status, source = excluded.source
          WHERE development_activity_participation.source <> 'manual'`;
      }
    }
    if (!activities) throw new Error("Ingen aktivitet kunde kopplas säkert");
    return { activities, unmatched: unmatched.slice(0, 30) };
  });
}
