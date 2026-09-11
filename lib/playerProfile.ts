import { SKILLS, type StatusMap } from './skillTrappan';
import type { TreeRow } from './treeConversation';

// Fokus är uttryckligt valt. Arbetssteg används bara under en egen rubrik.
export function profileFocus(statuses: StatusMap, rows: TreeRow[]) {
  const selected = new Set(rows.filter(row => row.is_focus).map(row => row.skill_id));
  const explicit = SKILLS.filter(skill => selected.has(skill.id));
  const working = SKILLS.filter(skill => ['training', 'almost'].includes(statuses[skill.id]));
  return { explicit: explicit.length > 0, skills: (explicit.length ? explicit : working).slice(0, 2) };
}

export function playerListContext(team?: string, query?: string) {
  const params = new URLSearchParams();
  if (team && team.length <= 80) params.set('lag', team);
  if (query && query.length <= 100) params.set('q', query);
  return params.toString();
}

export type PlayerTrainingStats = { training_count: number; recent_present: number; recent_absent: number; recent_unknown: number };

// Bara aktiviteter med registrerat deltagande eller kallelse för spelaren.
// Kallelsesvar får aldrig ersätta registrerad närvaro. Dagens pass kan pågå
// och räknas därför med först nästa kalenderdag.
export function playerTrainingStatsQuery(playerId: number, today: string) {
  const since = new Date(`${today}T12:00:00Z`);
  since.setUTCDate(since.getUTCDate() - 28);
  const recent = since.toISOString().slice(0, 10);
  return {
    sql: `WITH training AS (
      SELECT da.id, da.activity_date,
        EXISTS (SELECT 1 FROM development_activity_participation ap WHERE ap.activity_id=da.id AND ap.player_id=? AND ap.attendance_status='present') AS present,
        EXISTS (SELECT 1 FROM development_activity_participation ap WHERE ap.activity_id=da.id AND ap.player_id=? AND ap.attendance_status='absent') AS absent
      FROM development_activities da WHERE da.activity_type='training'
        AND da.activity_date >= ? AND da.activity_date < ?
        AND (EXISTS (SELECT 1 FROM development_activity_participation ap WHERE ap.activity_id=da.id AND ap.player_id=?)
          OR EXISTS (SELECT 1 FROM development_activity_callups ac WHERE ac.activity_id=da.id AND ac.player_id=?))
    ) SELECT
      COUNT(*) FILTER (WHERE present AND activity_date >= ?)::int AS training_count,
      COUNT(*) FILTER (WHERE activity_date >= ? AND present)::int AS recent_present,
      COUNT(*) FILTER (WHERE activity_date >= ? AND absent AND NOT present)::int AS recent_absent,
      COUNT(*) FILTER (WHERE activity_date >= ? AND NOT present AND NOT absent)::int AS recent_unknown
    FROM training`,
    args: [playerId, playerId, recent < `${today.slice(0, 4)}-01-01` ? recent : `${today.slice(0, 4)}-01-01`, today, playerId, playerId, `${today.slice(0, 4)}-01-01`, recent, recent, recent],
  };
}
