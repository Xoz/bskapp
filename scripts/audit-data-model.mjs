import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL saknas");

const sql = postgres(databaseUrl, { prepare: false });
const checks = [
  {
    severity: "error",
    name: "ovaliderade databaskonstraints",
    query: `SELECT COUNT(*)::int AS count FROM pg_constraint WHERE convalidated = false`,
  },
  {
    severity: "error",
    name: "cykler i grupphierarkin",
    query: `WITH RECURSIVE ancestry AS (
      SELECT id, parent_id, ARRAY[id] AS path, false AS cycle FROM groups
      UNION ALL
      SELECT ancestry.id, parent.parent_id, ancestry.path || parent.id,
             parent.id = ANY(ancestry.path) AS cycle
      FROM ancestry JOIN groups parent ON parent.id = ancestry.parent_id
      WHERE NOT ancestry.cycle
    ) SELECT COUNT(DISTINCT id)::int AS count FROM ancestry WHERE cycle`,
  },
  {
    severity: "error",
    name: "duplicerade kanoniska matcher",
    query: `SELECT COUNT(*)::int AS count FROM (
      SELECT date, COALESCE(start_time, ''),
             lower(regexp_replace(opponent, '^mot[[:space:]]+', '', 'i')), group_id
      FROM matches GROUP BY 1, 2, 3, 4 HAVING COUNT(*) > 1
    ) duplicate_matches`,
  },
  {
    severity: "error",
    name: "Svenska Lag-deltaganden utan match_players-rad",
    query: `SELECT COUNT(*)::int AS count
      FROM player_competition_match_players imported
      JOIN player_competition_matches imported_match
        ON imported_match.external_id = imported.match_external_id
      JOIN development_activities activity
        ON activity.external_key = 'sanktan:' || imported.match_external_id
      LEFT JOIN match_players canonical
        ON canonical.match_id = activity.match_id AND canonical.player_id = imported.player_id
      WHERE imported_match.match_date <= to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD')
        AND canonical.player_id IS NULL`,
  },
  {
    severity: "error",
    name: "Svenska Lag-matcher utan kanonisk matchlänk",
    query: `SELECT COUNT(*)::int AS count FROM development_activities
      WHERE external_source = 'svenskalag_sanktan' AND match_id IS NULL`,
  },
  {
    severity: "error",
    name: "importkontrollsummor som avviker från detaljhistoriken",
    query: `SELECT COUNT(*)::int AS count FROM (
      SELECT expected.player_id, expected.season, expected.competition, expected.source_team
      FROM player_competition_match_counts expected
      LEFT JOIN player_competition_matches imported_match
        ON imported_match.season = expected.season
       AND imported_match.competition = expected.competition
       AND imported_match.source_team = expected.source_team
      LEFT JOIN player_competition_match_players imported_player
        ON imported_player.match_external_id = imported_match.external_id
       AND imported_player.player_id = expected.player_id
      GROUP BY expected.player_id, expected.season, expected.competition,
               expected.source_team, expected.match_count
      HAVING expected.match_count <> COUNT(imported_player.match_external_id)
    ) checksum_drift`,
  },
  {
    severity: "error",
    name: "framtida matcher med faktiskt deltagande",
    query: `SELECT COUNT(*)::int AS count FROM match_players played
      JOIN matches match ON match.id = played.match_id
      WHERE match.date > to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD')`,
  },
  {
    severity: "error",
    name: "matchhändelser vars spelare saknas i match_players",
    query: `SELECT COUNT(*)::int AS count FROM match_events event
      WHERE event.player_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM match_players played
        WHERE played.match_id = event.match_id AND played.player_id = event.player_id
      )`,
  },
  {
    severity: "error",
    name: "matchutvärderingar för spelare utanför matchen",
    query: `SELECT COUNT(*)::int AS count FROM match_player_evaluations evaluation
      WHERE NOT EXISTS (SELECT 1 FROM match_roster roster WHERE roster.match_id = evaluation.match_id AND roster.player_id = evaluation.player_id AND roster.selection_status = 'selected')
        AND NOT EXISTS (SELECT 1 FROM match_players played WHERE played.match_id = evaluation.match_id AND played.player_id = evaluation.player_id)`,
  },
  {
    severity: "error",
    name: "observationer kopplade till en annan spelares mål",
    query: `SELECT COUNT(*)::int AS count FROM development_observations observation
      JOIN player_development_goals goal ON goal.id = observation.goal_id
      WHERE observation.player_id IS DISTINCT FROM goal.player_id`,
  },
  {
    severity: "error",
    name: "spelare med flera primära grupper",
    query: `SELECT COUNT(*)::int AS count FROM (
      SELECT player_id FROM player_group_memberships WHERE is_primary = 1
      GROUP BY player_id HAVING COUNT(*) > 1
    ) duplicate_primary`,
  },
  {
    severity: "warning",
    name: "aktiva spelare utan primär grupp",
    query: `SELECT COUNT(*)::int AS count FROM players player
      WHERE player.active = 1 AND NOT EXISTS (
        SELECT 1 FROM player_group_memberships membership
        JOIN groups player_group ON player_group.id = membership.group_id
        WHERE membership.player_id = player.id AND membership.is_primary = 1 AND player_group.active = 1
      )`,
  },
  {
    severity: "warning",
    name: "möjliga dubbla spelaridentiteter",
    query: `SELECT COUNT(*)::int AS count FROM (
      SELECT lower(regexp_replace(trim(name), '[^[:alnum:]]', '', 'g'))
      FROM players GROUP BY 1 HAVING COUNT(*) > 1
    ) duplicate_players`,
  },
  {
    severity: "warning",
    name: "avslutade matcher utan deltagare",
    query: `SELECT COUNT(*)::int AS count FROM matches match
      WHERE match.finished = 1
        AND NOT (match.match_type = 'cup' AND match.our_score IS NULL AND match.opponent_score IS NULL)
        AND NOT EXISTS (SELECT 1 FROM match_players played WHERE played.match_id = match.id)`,
  },
  {
    severity: "warning",
    name: "målhändelser som avviker från sparat resultat",
    query: `SELECT COUNT(*)::int AS count FROM matches match
      WHERE EXISTS (SELECT 1 FROM match_events event WHERE event.match_id = match.id)
        AND COALESCE(match.our_score, 0) <> (
          SELECT COUNT(*) FROM match_events event WHERE event.match_id = match.id AND event.stat_id = 'goals'
        )`,
  },
];

let failed = false;
try {
  for (const check of checks) {
    const [result] = await sql.unsafe(check.query);
    const count = Number(result?.count ?? 0);
    const marker = count === 0 ? "OK" : check.severity === "error" ? "FEL" : "VARNING";
    console.log(`${marker}: ${check.name} (${count})`);
    if (check.severity === "error" && count > 0) failed = true;
  }
} finally {
  await sql.end();
}

if (failed) process.exitCode = 1;
