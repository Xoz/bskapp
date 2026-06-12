import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "bsk.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    jersey_number INTEGER,
    notes TEXT DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    strengths TEXT DEFAULT '',
    development_goals TEXT DEFAULT '',
    coach_name TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS evaluation_scores (
    evaluation_id INTEGER NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
    skill_id TEXT NOT NULL,
    level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 4),
    PRIMARY KEY (evaluation_id, skill_id)
  );

  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    opponent TEXT NOT NULL,
    home_away TEXT NOT NULL DEFAULT 'home',
    match_type TEXT NOT NULL DEFAULT 'seriespel',
    our_score INTEGER,
    opponent_score INTEGER,
    notes TEXT DEFAULT '',
    created_by_role TEXT DEFAULT 'coach',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS match_players (
    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    minutes INTEGER NOT NULL DEFAULT 0,
    goals INTEGER NOT NULL DEFAULT 0,
    assists INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (match_id, player_id)
  );

  -- Händelselogg från live-rapporteringen: varje tryck = en händelse med matchtid,
  -- så att tränarna kan hitta rätt ögonblick i matchvideon
  CREATE TABLE IF NOT EXISTS match_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    stat_id TEXT NOT NULL,
    match_second INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_match_events_match ON match_events(match_id);
`);

// ---- Migrationer ----
function columnNames(table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((r) => r.name);
}

const mpCols = columnNames("match_players");
for (const col of ["shots", "shots_on_target", "passes_completed", "interceptions", "saves"]) {
  if (!mpCols.includes(col)) {
    db.exec(`ALTER TABLE match_players ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 0`);
  }
}

const matchCols = columnNames("matches");
if (!matchCols.includes("code")) db.exec(`ALTER TABLE matches ADD COLUMN code TEXT`);
if (!matchCols.includes("source")) db.exec(`ALTER TABLE matches ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'`);
if (!matchCols.includes("external_uid")) db.exec(`ALTER TABLE matches ADD COLUMN external_uid TEXT`);
// Matchklocka – delas av alla som rapporterar samma match
if (!matchCols.includes("clock_started_at")) db.exec(`ALTER TABLE matches ADD COLUMN clock_started_at INTEGER`);
if (!matchCols.includes("clock_offset")) db.exec(`ALTER TABLE matches ADD COLUMN clock_offset INTEGER NOT NULL DEFAULT 0`);
if (!matchCols.includes("clock_running")) db.exec(`ALTER TABLE matches ADD COLUMN clock_running INTEGER NOT NULL DEFAULT 0`);
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_code ON matches(code) WHERE code IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_uid ON matches(external_uid) WHERE external_uid IS NOT NULL;
`);

export function generateMatchCode(): string {
  // 6 siffror, unik bland matcher
  for (let i = 0; i < 50; i++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const exists = db.prepare("SELECT 1 FROM matches WHERE code = ?").get(code);
    if (!exists) return code;
  }
  throw new Error("Kunde inte generera en unik matchkod");
}

// Backfyll koder för matcher som saknar
{
  const withoutCode = db.prepare("SELECT id FROM matches WHERE code IS NULL").all() as { id: number }[];
  const setCode = db.prepare("UPDATE matches SET code = ? WHERE id = ?");
  for (const m of withoutCode) setCode.run(generateMatchCode(), m.id);
}

// ---- Seed ----
const settingsCount = db.prepare("SELECT COUNT(*) AS c FROM settings").get() as { c: number };
if (settingsCount.c === 0) {
  const insert = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
  const defaults: [string, string][] = [
    ["club_name", "Bollstanäs SK"],
    ["team_name", "BSK F2014"],
    ["birth_year", "2014"],
    ["primary_color", "#13306e"],
    ["accent_color", "#ffd23f"],
    ["coach_code", "TRANARE2014"],
    ["parent_code", "BSK2014"],
    ["season", "2026"],
  ];
  for (const [k, v] of defaults) insert.run(k, v);
}
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('calendar_url', '')").run();

const playerCount = db.prepare("SELECT COUNT(*) AS c FROM players").get() as { c: number };
if (playerCount.c === 0) {
  const insert = db.prepare("INSERT INTO players (name, jersey_number) VALUES (?, ?)");
  // Exempelspelare – ersätts med riktiga spelare under Spelare
  const demo = [
    "Exempel: Alva", "Exempel: Ebba", "Exempel: Elsa", "Exempel: Freja",
    "Exempel: Lilly", "Exempel: Maja", "Exempel: Nora", "Exempel: Saga",
    "Exempel: Stella", "Exempel: Vera",
  ];
  demo.forEach((name, i) => insert.run(name, i + 2));
}

export function getSetting(key: string): string {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? "";
}

export function setSetting(key: string, value: string) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}

export function getAllSettings(): Record<string, string> {
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export default db;
