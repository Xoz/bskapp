import "server-only";

import { run } from "./db";

/** Normaliserar externa importer till appens egna aktivitets- och matchtabeller. */
export async function syncDevelopmentSourceRows(): Promise<void> {
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
    INSERT INTO matches (
      date, start_time, opponent, home_away, match_type, group_id,
      source, external_uid, finished
    )
    SELECT da.activity_date, da.start_time,
           regexp_replace(da.title, '^(Match mot|Hemma mot|Borta mot)\\s+', '', 'i'),
           CASE WHEN da.title ~* '^Borta mot' THEN 'away' ELSE 'home' END,
           'seriespel', da.group_id, 'svenskalag_attendance',
           'attendance:' || replace(da.external_key, 'svenskalag:', ''), 1
    FROM development_activities da
    WHERE da.external_source = 'svenskalag_attendance'
      AND da.activity_type = 'match'
      AND da.activity_date <= to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD')
      AND EXISTS (
        SELECT 1 FROM development_activity_participation ap
        WHERE ap.activity_id = da.id AND ap.attendance_status = 'present'
      )
      AND NOT EXISTS (
        SELECT 1 FROM matches existing
        WHERE existing.date = da.activity_date
          AND COALESCE(existing.start_time, '') = COALESCE(da.start_time, '')
          AND lower(regexp_replace(existing.opponent, '^mot[[:space:]]+', '', 'i'))
              = lower(regexp_replace(da.title, '^(Match mot|Hemma mot|Borta mot)\\s+', '', 'i'))
      )
    ON CONFLICT (external_uid) WHERE external_uid IS NOT NULL DO UPDATE SET
      date = excluded.date, start_time = excluded.start_time,
      opponent = excluded.opponent, home_away = excluded.home_away, finished = 1
  `);
  await run(`
    INSERT INTO match_players (match_id, player_id)
    SELECT linked.id, ap.player_id
    FROM development_activities da
    JOIN development_activity_participation ap
      ON ap.activity_id = da.id AND ap.attendance_status = 'present'
    CROSS JOIN LATERAL (
      SELECT m.id FROM matches m
      WHERE m.external_uid = 'attendance:' || replace(da.external_key, 'svenskalag:', '')
         OR (
           m.date = da.activity_date
           AND COALESCE(m.start_time, '') = COALESCE(da.start_time, '')
           AND lower(regexp_replace(m.opponent, '^mot[[:space:]]+', '', 'i'))
               = lower(regexp_replace(da.title, '^(Match mot|Hemma mot|Borta mot)\\s+', '', 'i'))
         )
      ORDER BY CASE WHEN m.external_uid = 'attendance:' || replace(da.external_key, 'svenskalag:', '') THEN 0 ELSE 1 END, m.id
      LIMIT 1
    ) linked
    WHERE da.external_source = 'svenskalag_attendance' AND da.activity_type = 'match'
      AND da.activity_date <= to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD')
    ON CONFLICT (match_id, player_id) DO NOTHING
  `);
  await run(`
    WITH attendance_links AS (
      SELECT da.id AS activity_id, linked.id AS match_id
      FROM development_activities da
      CROSS JOIN LATERAL (
        SELECT m.id FROM matches m
        WHERE m.external_uid = 'attendance:' || replace(da.external_key, 'svenskalag:', '')
           OR (
             m.date = da.activity_date
             AND COALESCE(m.start_time, '') = COALESCE(da.start_time, '')
             AND lower(regexp_replace(m.opponent, '^mot[[:space:]]+', '', 'i'))
                 = lower(regexp_replace(da.title, '^(Match mot|Hemma mot|Borta mot)\\s+', '', 'i'))
           )
        ORDER BY CASE WHEN m.external_uid = 'attendance:' || replace(da.external_key, 'svenskalag:', '') THEN 0 ELSE 1 END, m.id
        LIMIT 1
      ) linked
      WHERE da.external_source = 'svenskalag_attendance' AND da.activity_type = 'match'
    )
    UPDATE development_activities da
    SET match_id = attendance_links.match_id
    FROM attendance_links
    WHERE da.id = attendance_links.activity_id
      AND NOT EXISTS (
        SELECT 1 FROM development_activities canonical_da
        WHERE canonical_da.match_id = attendance_links.match_id AND canonical_da.id <> da.id
      )
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
