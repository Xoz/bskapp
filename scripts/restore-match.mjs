// Kirurgisk återställning av en raderad match + all dess statistik.
//
// Kopierar matchraden och alla barnrader (spelarstatistik, händelser, trupp,
// startelva, byten) från en BACKUP-databas (Turso point-in-time-fork) in i
// LIVE-databasen. Original-id:t bevaras så all statistik kopplas rätt.
// Rör inget annat i live-databasen och är idempotent (INSERT OR IGNORE).
//
// ── Användning ────────────────────────────────────────────────────────────
// 1) Skapa en backup-fork till strax FÖRE raderingen (kräver Turso-CLI):
//      turso db create bsk-backup --from-db bsk --timestamp 2026-06-15T08:00:00Z
//      turso db show bsk-backup --url            # → FORK_URL
//      turso db tokens create bsk-backup         # → FORK_TOKEN
//    (live-uppgifterna är samma TURSO_DATABASE_URL/AUTH_TOKEN som appen använder)
//
// 2) Torrkör först (visar vad som skulle kopieras, skriver inget):
//      FORK_URL=... FORK_TOKEN=... LIVE_URL=... LIVE_TOKEN=... \
//      CUP_NAME="Örebro Cup" MATCH_DATE=2026-06-13 \
//      node scripts/restore-match.mjs
//
// 3) Kör skarpt genom att lägga till APPLY=1:
//      ... APPLY=1 node scripts/restore-match.mjs

import { createClient } from "@libsql/client";

const { FORK_URL, FORK_TOKEN, LIVE_URL, LIVE_TOKEN, CUP_NAME, MATCH_DATE } = process.env;
const APPLY = process.env.APPLY === "1";

if (!FORK_URL || !LIVE_URL) {
  console.error("Saknar FORK_URL/LIVE_URL (+ tokens). Se kommentaren överst i filen.");
  process.exit(1);
}

const fork = createClient({ url: FORK_URL, authToken: FORK_TOKEN, intMode: "number" });
const live = createClient({ url: LIVE_URL, authToken: LIVE_TOKEN, intMode: "number" });

const CHILD_TABLES = ["match_players", "match_events", "match_squad", "match_lineup", "match_subs"];

async function copyRows(table, whereSql, whereArgs, apply) {
  const res = await fork.execute({ sql: `SELECT * FROM ${table} WHERE ${whereSql}`, args: whereArgs });
  if (res.rows.length === 0) return 0;
  const cols = res.columns;
  for (const r of res.rows) {
    if (apply) {
      await live.execute({
        sql: `INSERT OR IGNORE INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
        args: cols.map((c) => r[c]),
      });
    }
  }
  return res.rows.length;
}

// 1. Hitta kandidatmatcher i backupen (samma cup + datum)
const where = MATCH_DATE ? "cup_name = ? AND date = ?" : "cup_name = ?";
const args = MATCH_DATE ? [CUP_NAME, MATCH_DATE] : [CUP_NAME];
const candidates = await fork.execute({ sql: `SELECT * FROM matches WHERE ${where}`, args });

console.log(`\nHittade ${candidates.rows.length} match(er) i backupen för "${CUP_NAME}"${MATCH_DATE ? ` ${MATCH_DATE}` : ""}:`);

let restored = 0;
for (const m of candidates.rows) {
  const id = m.id;
  const inLive = await live.execute({ sql: "SELECT 1 FROM matches WHERE id = ?", args: [id] });
  const present = inLive.rows.length > 0;
  const score = m.our_score != null ? `${m.our_score}–${m.opponent_score}` : "–";
  console.log(`  • id=${id}  ${m.home_away === "home" ? "Hemma" : "Borta"} mot ${m.opponent}  ${score}  ${present ? "→ FINNS redan i live (hoppar)" : "→ SAKNAS i live"}`);
  if (present) continue;

  await copyRows("matches", "id = ?", [id], APPLY);
  let childTotal = 0;
  for (const t of CHILD_TABLES) childTotal += await copyRows(t, "match_id = ?", [id], APPLY);
  console.log(`      ${APPLY ? "Återställde" : "Skulle återställa"} matchen + ${childTotal} statistik-/händelserader`);
  restored++;
}

console.log(`\n${APPLY ? "KLART" : "TORRKÖRNING"}: ${restored} match(er) ${APPLY ? "återställda" : "att återställa"}.`);
if (!APPLY && restored > 0) console.log("Lägg till APPLY=1 för att skriva till live-databasen.\n");

await Promise.resolve();
process.exit(0);
