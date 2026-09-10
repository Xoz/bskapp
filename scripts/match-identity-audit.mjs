// Stabilt käll-id skiljer parallella cupmatcher åt. Namn/tid är endast fallback.
export const duplicateMatchQuery = `WITH identified AS (
  SELECT m.*,
    CASE WHEN m.source IN ('calendar','svenskalag_sanktan') THEN COALESCE(
      substring(m.external_uid from '^sanktan:([0-9]+)$'),
      substring(m.external_uid from '^cal([0-9]+)-[0-9]+@svenskalag[.]se$'),
      (SELECT substring(da.external_key from '^sanktan:([0-9]+)$')
       FROM development_activities da WHERE da.match_id=m.id AND da.group_id=m.group_id LIMIT 1)
    ) END AS source_id
  FROM matches m WHERE m.cancelled=0
), duplicates AS (
  SELECT group_id FROM identified WHERE source_id IS NOT NULL
    GROUP BY group_id,source_id HAVING count(*)>1
  UNION ALL
  SELECT group_id FROM identified
    GROUP BY date,COALESCE(start_time,''),lower(regexp_replace(opponent,'^mot[[:space:]]+','','i')),group_id
    HAVING count(*)>1 AND count(source_id)<count(*)
) SELECT count(*)::int AS count FROM duplicates`;
