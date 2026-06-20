// READ-ONLY diagnostik: jämför mål i match_events (loggen) mot match_players.goals
// (aggregaten) per match i en cup. Skriver INGET. Hittar matcher där de två
// källorna glidit isär (t.ex. mål reggade efter avslut som sedan skrivits över
// av tränarens spara-formulär → syns i tidslinjen men saknas i "Skyttar i cupen").
//
// Körs med produktionens Supabase-uppgifter (samma DATABASE_URL som appen använder):
//   DATABASE_URL=... node scripts/diag-cup-goals.mjs "Örebro Cup"
// Utan cup-argument listas alla cup_name.

import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Sätt DATABASE_URL i miljön.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false });

const cup = process.argv[2];
if (!cup) {
  const cups = await sql`SELECT DISTINCT cup_name FROM matches WHERE cup_name <> '' ORDER BY cup_name`;
  console.log("Ange en cup. Tillgängliga:");
  for (const c of cups) console.log("  -", c.cup_name);
  await sql.end();
  process.exit(0);
}

const matches = await sql`
  SELECT id, date, opponent, finished, our_score, opponent_score
  FROM matches WHERE cup_name = ${cup} ORDER BY date, id`;
if (!matches.length) {
  console.log("Inga matcher med cup_name =", JSON.stringify(cup));
  await sql.end();
  process.exit(0);
}

const ids = matches.map((m) => m.id);

const mpByMatch = {}, evByMatch = {};
for (const r of await sql`
  SELECT match_id, COALESCE(SUM(goals),0) g FROM match_players
  WHERE match_id IN ${sql(ids)} GROUP BY match_id`) mpByMatch[r.match_id] = Number(r.g);
for (const r of await sql`
  SELECT match_id, COUNT(*) c FROM match_events
  WHERE match_id IN ${sql(ids)} AND stat_id = 'goals' GROUP BY match_id`) evByMatch[r.match_id] = Number(r.c);

console.log(`\n== ${cup} ==`);
console.log("match | datum | motståndare | finished | our_score | mp.goals | event-mål");
let our = 0, mp = 0, ev = 0;
for (const m of matches) {
  our += Number(m.our_score || 0); mp += (mpByMatch[m.id] || 0); ev += (evByMatch[m.id] || 0);
  const flag = (mpByMatch[m.id] || 0) !== (evByMatch[m.id] || 0) ? "  <-- glidit isär" : "";
  console.log(`#${m.id} | ${m.date} | ${m.opponent} | fin=${m.finished} | ${m.our_score} | ${mpByMatch[m.id] || 0} | ${evByMatch[m.id] || 0}${flag}`);
}
console.log(`SUMMA: our_score=${our}  mp.goals=${mp}  events=${ev}`);

console.log("\n== per spelare: mål-events vs match_players (cup-matcherna) ==");
const rows = await sql`
  SELECT COALESCE(p.name,'(ospecificerad)') name,
    (SELECT COUNT(*) FROM match_events e2
       WHERE e2.player_id IS NOT DISTINCT FROM e.player_id AND e2.match_id IN ${sql(ids)} AND e2.stat_id = 'goals') ev_goals,
    (SELECT COALESCE(SUM(g.goals),0) FROM match_players g
       WHERE g.player_id IS NOT DISTINCT FROM e.player_id AND g.match_id IN ${sql(ids)}) mp_goals
  FROM match_events e LEFT JOIN players p ON p.id = e.player_id
  WHERE e.match_id IN ${sql(ids)} AND e.stat_id = 'goals'
  GROUP BY e.player_id, p.name ORDER BY ev_goals DESC`;
for (const r of rows) {
  const flag = Number(r.ev_goals) !== Number(r.mp_goals) ? "  <-- GLIDIT ISÄR" : "";
  console.log(`${r.name}: events=${r.ev_goals}  match_players=${r.mp_goals}${flag}`);
}

await sql.end();
