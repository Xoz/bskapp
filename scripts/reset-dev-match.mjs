// Återställer dev-testmatchen ("Dev Testmatch") till ett rent pågående tillstånd
// inför/efter ett test: raderar händelser, räknare, byten och rapportörer och
// nollställer klocka/resultat — men BEHÅLLER trupp (match_squad) och startelva
// (match_lineup). Speglar resetMatch() i lib/actions.ts.
//
//   DATABASE_URL=postgresql://xozozmen@localhost:5432/bskdev node scripts/reset-dev-match.mjs
//
// Säkerhetsspärr: vägrar köra mot något som ser ut som produktion.

import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL saknas. Sätt den till den lokala bskdev-databasen.");
  process.exit(1);
}
if (!/localhost|127\.0\.0\.1/.test(url) || /supabase|pooler/.test(url)) {
  console.error("VÄGRAR: DATABASE_URL ser inte ut som en lokal databas. Avbryter för säkerhets skull.");
  process.exit(1);
}

const sql = postgres(url, { prepare: false });

try {
  const match = (await sql`SELECT id FROM matches WHERE opponent = 'Dev Testmatch' ORDER BY id DESC LIMIT 1`)[0];
  if (!match) {
    console.error("Hittar ingen 'Dev Testmatch' — kör scripts/seed-dev.mjs först.");
    process.exit(1);
  }
  const id = match.id;
  await sql`DELETE FROM match_events WHERE match_id = ${id}`;
  await sql`DELETE FROM match_players WHERE match_id = ${id}`;
  await sql`DELETE FROM match_subs WHERE match_id = ${id}`;
  await sql`DELETE FROM match_reporters WHERE match_id = ${id}`;
  await sql`DELETE FROM live_rate_limits WHERE match_id = ${id}`;
  await sql`UPDATE matches SET our_score = NULL, opponent_score = NULL, clock_running = 0, clock_offset = 0, clock_started_at = NULL, clock_period = 1, finished = 0, report_open = 1 WHERE id = ${id}`;
  console.log(`Återställde testmatch #${id} (trupp + startelva behölls).`);
} finally {
  await sql.end();
}
