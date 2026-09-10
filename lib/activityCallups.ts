// Statiska SQL-fragment för läsmodeller med alias da (aktivitet) och m (match).
// Matcher använder den gemensamma matchtruppen; träningar har egna kallelsetabeller.
const statuses = [['accepted','present'],['declined','absent'],['pending','unknown']] as const;
const matchReplyCount=(reply:string,alias:string)=>`COALESCE(${alias}.callup_${reply}_count,
    (SELECT COUNT(*) FROM match_roster mr WHERE mr.match_id=${alias}.id AND mr.callup_status='${reply}'))`;
export function matchCallupCountsSql(alias: 'm' | 'linked_match' = 'm'): string {
  return statuses.map(([reply])=>`${matchReplyCount(reply,alias)}::int AS ${reply}_callup_count`).join(',');
}
export const activityCallupCountsSql = statuses.map(([reply,presence])=>`
  (CASE WHEN m.id IS NOT NULL THEN ${matchReplyCount(reply,'m')}
  ELSE COALESCE(
    (SELECT s.${reply}_count FROM development_activity_callup_summaries s WHERE s.activity_id=da.id),
    (SELECT COUNT(*) FROM development_activity_callups dac WHERE dac.activity_id=da.id AND dac.attendance_status='${presence}')
  ) END)::int AS ${reply}_callup_count`).join(',');
export const activityCallupNamesSql = [['called',null],...statuses].map(([reply,presence])=>`
  ARRAY(SELECT p.name FROM players p JOIN (
    SELECT mr.player_id FROM match_roster mr WHERE mr.match_id=m.id
      AND ${presence?`mr.callup_status='${reply}'`:"mr.callup_status IN ('accepted','declined','pending')"}
    UNION ALL
    SELECT dac.player_id FROM development_activity_callups dac WHERE m.id IS NULL AND dac.activity_id=da.id
      ${presence?`AND dac.attendance_status='${presence}'`:''}
  ) called ON called.player_id=p.id ORDER BY p.name) AS ${reply}_player_names`).join(',');
