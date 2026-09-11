// Cuper hanteras separat från ordinarie matchantal och matchutrymme.
// Alias kommer endast från kod, aldrig användarindata.
export function regularMatchSql(alias = 'm'): string {
  if (!/^[a-z_]+$/.test(alias)) throw new Error('Ogiltigt SQL-alias');
  return `(COALESCE(${alias}.match_type, '') <> 'cup'
    AND NULLIF(trim(${alias}.cup_name), '') IS NULL
    AND NOT EXISTS (SELECT 1 FROM settings cup_meta
      WHERE cup_meta.key = 'svenskalag_match_metadata:' || ${alias}.id::text
        AND CASE WHEN cup_meta.key = 'svenskalag_match_metadata:' || ${alias}.id::text
          THEN cup_meta.value::jsonb->>'scope' = 'cup' ELSE false END)
    AND NOT EXISTS (
      WITH RECURSIVE ancestors AS (
        SELECT id, parent_id, group_type FROM groups WHERE id = ${alias}.group_id
        UNION SELECT g.id, g.parent_id, g.group_type FROM groups g JOIN ancestors a ON g.id = a.parent_id
      ) SELECT 1 FROM ancestors WHERE group_type = 'matchgroup'
    ))`;
}
