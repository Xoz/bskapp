// Seedar den LOKALA dev-databasen med en testmatch idag (trupp + startelva) så
// liverapporteringen kan testas direkt. Idempotent: kör om utan att dubblera.
//
// Körs efter att dev-servern startat minst en gång (då har lib/db.ts init()
// skapat schema, demospelare och grupper). Kör:
//   DATABASE_URL=postgresql://xozozmen@localhost:5432/bskdev node scripts/seed-dev.mjs
//
// Säkerhetsspärr: vägrar köra mot en URL som ser ut som produktion (Supabase).

import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL saknas. Sätt den till den lokala bskdev-databasen.");
  process.exit(1);
}
if (!/localhost|127\.0\.0\.1/.test(url) || /supabase|pooler/.test(url)) {
  console.error("VÄGRAR: DATABASE_URL ser inte ut som en lokal databas. Avbryter för säkerhets skull.");
  console.error("URL:", url.replace(/:[^:@/]*@/, ":***@"));
  process.exit(1);
}

const sql = postgres(url, { prepare: false });

const OPPONENT = "Dev Testmatch";

function swedishToday() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

try {
  const today = swedishToday();

  // Säkerställ att det finns demospelare (init() seedar dem; men om scriptet körs
  // före första app-anropet skapar vi dem här så scriptet är självförsörjande).
  const playerCount = Number((await sql`SELECT COUNT(*)::int AS c FROM players`)[0].c);
  if (playerCount === 0) {
    const demo = ["Alva", "Ebba", "Elsa", "Freja", "Lilly", "Maja", "Nora", "Saga", "Stella", "Vera"];
    for (let i = 0; i < demo.length; i++) {
      await sql`INSERT INTO players (name, jersey_number) VALUES (${"Exempel: " + demo[i]}, ${i + 2})`;
    }
    console.log("Skapade 10 demospelare.");
  }

  const players = await sql`SELECT id, name FROM players WHERE active = 1 ORDER BY id LIMIT 12`;
  if (players.length === 0) throw new Error("Inga aktiva spelare att seeda matchen med.");

  // Använd den första undergruppen (init() skapar 'Gul') som matchens grupp.
  const subgroup = (await sql`SELECT id FROM groups WHERE group_type = 'subgroup' ORDER BY id LIMIT 1`)[0];
  const groupId = subgroup?.id ?? null;

  // Avspark satt till strax innan nu så matchen direkt räknas som pågående.
  const startTime = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm", hour: "2-digit", minute: "2-digit",
  }).format(new Date(Date.now() - 5 * 60000));

  // Hitta-eller-skapa dagens testmatch (idempotent på opponent + datum).
  let match = (await sql`SELECT id FROM matches WHERE opponent = ${OPPONENT} AND date = ${today} LIMIT 1`)[0];
  if (!match) {
    match = (await sql`
      INSERT INTO matches (date, opponent, home_away, match_type, start_time, periods, period_minutes, group_id, report_open)
      VALUES (${today}, ${OPPONENT}, 'home', 'seriespel', ${startTime}, 3, 20, ${groupId}, 1)
      RETURNING id`)[0];
    console.log(`Skapade testmatch #${match.id} (${OPPONENT}, ${today} ${startTime}).`);
  } else {
    await sql`UPDATE matches SET start_time = ${startTime}, finished = 0, report_open = 1 WHERE id = ${match.id}`;
    console.log(`Återanvänder testmatch #${match.id} (återställd till pågående).`);
  }
  const matchId = match.id;

  // Hela truppen kallad.
  for (const p of players) {
    await sql`INSERT INTO match_roster (match_id, player_id, selection_status, source)
              VALUES (${matchId}, ${p.id}, 'selected', 'dev-seed')
              ON CONFLICT (match_id, player_id) DO UPDATE SET selection_status = 'selected'`;
  }

  // Startelva: de 7 första spelarna med enkla planpositioner.
  const starters = players.slice(0, 7);
  const positions = [
    [50, 90], [25, 65], [50, 65], [75, 65], [30, 35], [70, 35], [50, 12],
  ];
  await sql`UPDATE match_roster SET lineup_x = NULL, lineup_y = NULL WHERE match_id = ${matchId}`;
  for (let i = 0; i < starters.length; i++) {
    const [x, y] = positions[i];
    await sql`UPDATE match_roster SET lineup_x = ${x / 100}, lineup_y = ${y / 100} WHERE match_id = ${matchId} AND player_id = ${starters[i].id}`;
  }

  console.log(`Klart: match #${matchId}, ${players.length} i truppen, ${starters.length} i startelvan.`);
  console.log(`\nTesta live: starta dev-servern, öppna /api/auth/dev, gå sedan till matchen #${matchId}.`);
} finally {
  await sql.end();
}
