import { regularMatchSql } from "./regularMatches";
// Gemensam matchavgränsning för spelarlista, profilens räknare och historik.
function matchScope(today: string, team: string | null, period: "current" | "earlier" = "current") {
  const year = Number(today.slice(0, 4));
  return {
    sql: `WITH RECURSIVE team_groups AS (
      SELECT id FROM groups WHERE group_type = 'subgroup' AND name = ?
      UNION
      SELECT g.id FROM groups g JOIN team_groups parent ON g.parent_id = parent.id
    ), scoped_matches AS (
      SELECT m.* FROM matches m
      WHERE ${regularMatchSql()} AND COALESCE(m.cancelled, 0) = 0 AND m.date >= ? AND m.date < ?
        AND (?::text IS NULL OR m.group_id IN (SELECT id FROM team_groups))
    )`,
    args: [team, period === "earlier" ? "0001-01-01" : `${year}-01-01`, `${period === "earlier" ? year : year + 1}-01-01`, team],
  };
}

// Anroparen skickar endast spelar-id:n som användaren har läsbehörighet till.
export function playerDirectoryStatsQuery(playerIds: number[], today: string, team: string | null) {
  const scope = matchScope(today, team);
  return {
    sql: `${scope.sql}
    SELECT p.id AS player_id,
      (SELECT COUNT(DISTINCT mp.match_id)::int FROM match_players mp
       JOIN scoped_matches m ON m.id = mp.match_id
       WHERE mp.player_id = p.id AND (m.finished = 1 OR m.date <= ?)) AS match_count,
      (SELECT COUNT(DISTINCT mr.match_id)::int FROM match_roster mr
       JOIN scoped_matches m ON m.id = mr.match_id
       WHERE mr.player_id = p.id AND mr.callup_status IN ('accepted', 'declined', 'pending')) AS callup_count
    FROM players p WHERE p.id IN (${playerIds.length ? playerIds.map(() => '?').join(',') : 'NULL'})`,
    args: [...scope.args, today, ...playerIds],
  };
}

export type PlayerMatchHistoryRow = {
  id: number; date: string; opponent: string; match_type: string; source_team: string | null;
};

export function playerMatchHistoryQuery(playerId: number, today: string, period: "current" | "earlier" = "current") {
  const scope = matchScope(today, null, period);
  return {
    sql: `${scope.sql}
      SELECT m.id, m.date, m.opponent, m.match_type, g.name AS source_team
      FROM scoped_matches m LEFT JOIN groups g ON g.id = m.group_id
      WHERE (m.finished = 1 OR m.date <= ?)
        AND EXISTS (SELECT 1 FROM match_players mp WHERE mp.match_id=m.id AND mp.player_id=?)
      ORDER BY m.date DESC, m.id DESC`,
    args: [...scope.args, today, playerId],
  };
}
