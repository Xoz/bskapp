// Engångsmigrering: kopierar lokal data/bsk.db → Turso.
// Körs med TURSO_DATABASE_URL och TURSO_AUTH_TOKEN i miljön.
import { createClient } from "@libsql/client";
import path from "path";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error("Saknar TURSO_DATABASE_URL eller TURSO_AUTH_TOKEN");
  process.exit(1);
}

const local = createClient({ url: `file:${path.resolve("data/bsk.db")}`, intMode: "number" });
const remote = createClient({ url, authToken, intMode: "number" });

// Schemat (tabeller + index) hämtas direkt ur den lokala databasen
const schema = await local.execute(
  "SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY (type='index')"
);
for (const row of schema.rows) {
  await remote.execute(row.sql);
}
console.log(`Schema: ${schema.rows.length} objekt skapade`);

// Tabeller i beroendeordning (föräldrar före barn)
const tables = [
  "settings",
  "players",
  "evaluations",
  "evaluation_scores",
  "matches",
  "match_players",
  "match_events",
];

for (const table of tables) {
  const data = await local.execute(`SELECT * FROM ${table}`);
  if (data.rows.length === 0) {
    console.log(`${table}: 0 rader`);
    continue;
  }
  const cols = data.columns;
  const placeholders = cols.map(() => "?").join(", ");
  const sql = `INSERT OR REPLACE INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`;
  const stmts = data.rows.map((r) => ({ sql, args: cols.map((c) => r[c]) }));
  // Batcha i klumpar så vi inte överskrider gränser
  for (let i = 0; i < stmts.length; i += 100) {
    await remote.batch(stmts.slice(i, i + 100), "write");
  }
  console.log(`${table}: ${data.rows.length} rader kopierade`);
}

console.log("Klart.");
