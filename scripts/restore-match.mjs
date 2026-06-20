// Kirurgisk återställning av en raderad match + all dess statistik.
//
// Kopierar matchraden och alla barnrader (spelarstatistik, händelser, trupp,
// startelva, byten) från en BACKUP-databas (Turso point-in-time-fork, kvar
// som rollback-säkerhetsnät efter Supabase-flytten) in i LIVE-databasen
// (Supabase/Postgres). Original-id:t bevaras så all statistik kopplas rätt.
// Rör inget annat i live-databasen och är idempotent (ON CONFLICT DO NOTHING
// – kolliderar en redan kopierad rads id hoppas den bara över).
//
// ── Användning ────────────────────────────────────────────────────────────
// 1) Skapa en backup-fork till strax FÖRE raderingen (kräver Turso-CLI):
//      turso db create bsk-backup --from-db bsk --timestamp 2026-06-15T08:00:00Z
//      turso db show bsk-backup --url            # → FORK_URL
//      turso db tokens create bsk-backup         # → FORK_TOKEN
//
// 2) Torrkör först (visar vad som skulle kopieras, skriver inget):
//      FORK_URL=... FORK_TOKEN=... LIVE_URL=... \
//      CUP_NAME="Örebro Cup" MATCH_DATE=2026-06-13 \
//      node scripts/restore-match.mjs
//
// 3) Kör skarpt genom att lägga till APPLY=1:
//      ... APPLY=1 node scripts/restore-match.mjs
//
// LIVE_URL = appens DATABASE_URL (Supabase connection string).

import { createClient } from "@libsql/client";
import postgres from "postgres";

const { FORK_URL, FORK_TOKEN, LIVE_URL, CUP_NAME, MATCH_DATE, MATCH_ID } = process.env;
const APPLY = process.env.APPLY === "1";

if (!FORK_URL || !LIVE_URL) {
  console.error("Saknar FORK_URL (+ FORK_TOKEN) eller LIVE_URL. Se kommentaren överst i filen.");
  process.exit(1);
}

const fork = createClient({ url: FORK_URL, authToken: FORK_TOKEN, intMode: "number" });
const live = postgres(LIVE_URL, { prepare: false });

const CHILD_TABLES = ["match_players", "match_events", "match_squad", "match_lineup", "match_subs"];

async function copyRows(table, whereSql, whereArgs, apply) {
  const res = await fork.execute({ sql: `SELECT * FROM ${table} WHERE ${whereSql}`, args: whereArgs });
  if (res.rows.length === 0) return 0;
  const cols = res.columns;
  if (apply) {
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
    for (const r of res.rows) {
      await live.unsafe(
        `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
        cols.map((c) => r[c])
      );
    }
  }
  return res.rows.length;
}

// 1. Hitta kandidatmatcher i backupen. MATCH_ID är mest precist; annars cup+datum.
let where, args, label;
if (MATCH_ID) {
  where = "id = ?";
  args = [Number(MATCH_ID)];
  label = `id=${MATCH_ID}`;
} else if (MATCH_DATE) {
  where = "cup_name = ? AND date = ?";
  args = [CUP_NAME, MATCH_DATE];
  label = `"${CUP_NAME}" ${MATCH_DATE}`;
} else {
  where = "cup_name = ?";
  args = [CUP_NAME];
  label = `"${CUP_NAME}"`;
}
const candidates = await fork.execute({ sql: `SELECT * FROM matches WHERE ${where}`, args });

console.log(`\nHittade ${candidates.rows.length} match(er) i backupen för ${label}:`);

let restored = 0;
const touchedIds = new Set();
for (const m of candidates.rows) {
  const id = m.id;
  const inLive = await live.unsafe("SELECT 1 FROM matches WHERE id = $1", [id]);
  const present = inLive.length > 0;
  const score = m.our_score != null ? `${m.our_score}–${m.opponent_score}` : "–";
  console.log(`  • id=${id}  ${m.home_away === "home" ? "Hemma" : "Borta"} mot ${m.opponent}  ${score}  ${present ? "→ FINNS redan i live (hoppar)" : "→ SAKNAS i live"}`);
  if (present) continue;

  await copyRows("matches", "id = ?", [id], APPLY);
  touchedIds.add(id);
  let childTotal = 0;
  for (const t of CHILD_TABLES) childTotal += await copyRows(t, "match_id = ?", [id], APPLY);
  console.log(`      ${APPLY ? "Återställde" : "Skulle återställa"} matchen + ${childTotal} statistik-/händelserader`);
  restored++;
}

// Identity-sekvenserna känner inte till de manuellt insatta id:na – synka dem
// så nästa vanliga INSERT (via appen) inte kolliderar med en återställd rad.
if (APPLY && touchedIds.size > 0) {
  for (const table of ["matches", "match_events", "match_subs"]) {
    await live.unsafe(
      `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`
    );
  }
}

console.log(`\n${APPLY ? "KLART" : "TORRKÖRNING"}: ${restored} match(er) ${APPLY ? "återställda" : "att återställa"}.`);
if (!APPLY && restored > 0) console.log("Lägg till APPLY=1 för att skriva till live-databasen.\n");

await live.end();
process.exit(0);
