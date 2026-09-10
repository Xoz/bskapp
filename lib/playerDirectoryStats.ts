// Spelarlistans statistik gäller samma år och matchgrupp för båda räknarna.
// Anroparen skickar endast spelar-id:n som användaren har läsbehörighet till.
export function playerDirectoryStatsQuery(playerIds: number[], today: string, team: string | null) {
  const year = Number(today.slice(0, 4));
  return {
    sql: `WITH RECURSIVE team_groups AS (
      SELECT id FROM groups WHERE group_type = 'subgroup' AND name = ?
      UNION
      SELECT g.id FROM groups g JOIN team_groups parent ON g.parent_id = parent.id
    ), scoped_matches AS (
      SELECT m.id, m.date, m.finished FROM matches m
      WHERE COALESCE(m.cancelled, 0) = 0 AND m.date >= ? AND m.date < ?
        AND (?::text IS NULL OR m.group_id IN (SELECT id FROM team_groups))
    )
    SELECT p.id AS player_id,
      (SELECT COUNT(DISTINCT mp.match_id)::int FROM match_players mp
       JOIN scoped_matches m ON m.id = mp.match_id
       WHERE mp.player_id = p.id AND (m.finished = 1 OR m.date <= ?)) AS match_count,
      (SELECT COUNT(DISTINCT mr.match_id)::int FROM match_roster mr
       JOIN scoped_matches m ON m.id = mr.match_id
       WHERE mr.player_id = p.id AND mr.callup_status IN ('accepted', 'declined', 'pending')) AS callup_count
    FROM players p WHERE p.id IN (${playerIds.length ? playerIds.map(() => '?').join(',') : 'NULL'})`,
    args: [team, `${year}-01-01`, `${year + 1}-01-01`, team, today, ...playerIds],
  };
}
