import "server-only";

import { run } from "./db";

/** Speglar externa referenser till utvecklingskärnan utan att ta över källans ansvar. */
export async function syncDevelopmentSourceRows(): Promise<void> {
  // Sanktan importeras separat med detaljerad matchhistorik från Svenska Lag.
  // Behåll den äldre speglingen inaktiv så att olika datakällor inte blandas.
  return;

  await run(`
    INSERT INTO development_activities (
      id, activity_date, start_time, activity_type, title,
      external_source, external_key, match_id, group_id
    )
    SELECT 'match-' || m.id::text, m.date, m.start_time, 'match',
      CASE WHEN m.home_away = 'away' THEN 'Borta mot ' ELSE 'Hemma mot ' END || m.opponent,
      COALESCE(NULLIF(m.source, ''), 'match'), 'match:' || m.id::text, m.id, m.group_id
    FROM matches m
    ON CONFLICT (external_key) DO UPDATE SET
      activity_date = excluded.activity_date, start_time = excluded.start_time,
      title = excluded.title, group_id = excluded.group_id,
      updated_at = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
  `);
  await run(`
    INSERT INTO development_activities (
      id, activity_date, start_time, activity_type, title, external_source, external_key
    )
    SELECT
      'svenskalag-' || md5(concat_ws('|', ae.activity_date, ae.start_time, ae.title, ae.category)),
      ae.activity_date, MIN(ae.start_time),
      CASE WHEN ae.category = 'training' THEN 'training' WHEN ae.category = 'match' THEN 'match' ELSE 'other' END,
      COALESCE(NULLIF(MAX(ae.title), ''), 'Aktivitet'), 'svenskalag_attendance',
      'svenskalag:' || md5(concat_ws('|', ae.activity_date, ae.start_time, ae.title, ae.category))
    FROM attendance_events ae
    WHERE ae.import_id = (SELECT id FROM attendance_imports ORDER BY id DESC LIMIT 1)
      AND ae.activity_date IS NOT NULL
    GROUP BY ae.activity_date, ae.start_time, ae.title, ae.category
    ON CONFLICT (external_key) DO UPDATE SET
      activity_date = excluded.activity_date, start_time = excluded.start_time,
      activity_type = excluded.activity_type, title = excluded.title,
      updated_at = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
  `);
  await run(`
    INSERT INTO development_activity_participation (activity_id, player_id, attendance_status, source)
    SELECT da.id, ae.player_id,
      CASE WHEN MAX(ae.present) = 1 THEN 'present' ELSE 'absent' END, 'svenskalag_attendance'
    FROM attendance_events ae
    JOIN development_activities da
      ON da.external_key = 'svenskalag:' || md5(concat_ws('|', ae.activity_date, ae.start_time, ae.title, ae.category))
    WHERE ae.import_id = (SELECT id FROM attendance_imports ORDER BY id DESC LIMIT 1)
      AND ae.player_id IS NOT NULL
    GROUP BY da.id, ae.player_id
    ON CONFLICT (activity_id, player_id) DO UPDATE SET
      attendance_status = excluded.attendance_status, source = excluded.source,
      updated_at = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
  `);
  await run(`
    INSERT INTO development_activity_participation
      (activity_id, player_id, attendance_status, selected, periods_played, source)
    SELECT da.id, mp.player_id, 'present', 1, 0, 'legacy_match'
    FROM match_players mp JOIN development_activities da ON da.match_id = mp.match_id
    ON CONFLICT (activity_id, player_id) DO UPDATE SET
      attendance_status = 'present', selected = 1,
      source = CASE WHEN development_activity_participation.source = 'manual'
        THEN development_activity_participation.source ELSE excluded.source END,
      updated_at = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
  `);
}
