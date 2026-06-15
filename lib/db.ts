// Databaslager: Turso (libSQL) i produktion, lokal SQLite-fil vid utveckling.
// Sätt TURSO_DATABASE_URL + TURSO_AUTH_TOKEN i miljön (Vercel) – utan dem
// används data/bsk.db lokalt med samma API.
//
// I produktion används @libsql/client/web (ren JavaScript, inga binärer) som
// fungerar på Vercels serverless-miljö. Lokalt används node-klienten för
// att kunna läsa en fil (file:).

import type { Client, InArgs, ResultSet } from "@libsql/client";

let clientPromise: Promise<Client> | null = null;

async function makeClient(): Promise<Client> {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) {
    const { createClient } = await import("@libsql/client/web");
    return createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
      intMode: "number",
    });
  }
  const path = await import("path");
  const fs = await import("fs");
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const { createClient } = await import("@libsql/client");
  return createClient({ url: `file:${path.join(dataDir, "bsk.db")}`, intMode: "number" });
}

function getClient(): Promise<Client> {
  if (!clientPromise) clientPromise = makeClient();
  return clientPromise;
}

async function tryExec(sql: string) {
  try {
    await (await getClient()).execute(sql);
  } catch (e) {
    // "duplicate column name" m.m. vid återkörda migrationer är förväntat
    const msg = e instanceof Error ? e.message : String(e);
    if (!/duplicate column|already exists/i.test(msg)) throw e;
  }
}

// Bumpa vid VARJE schemaändring nedan (ny tabell/kolumn/migration). Grinden
// nedan hoppar över all DDL när databasen redan är på denna version – annars
// körs ~40 sekventiella satser mot Turso vid varje kall serverless-start.
const SCHEMA_VERSION = "2026-06-15c";

async function init(): Promise<void> {
  // Snabbväg: är schemat redan aktuellt? Hoppa över tabeller/migrationer/seed.
  // OBS: rå-klienten används här – get/all/run anropar ready() → init() (rekursion).
  try {
    const res = await (await getClient()).execute(
      "SELECT value FROM settings WHERE key = 'schema_version'"
    );
    if (res.rows[0]?.value === SCHEMA_VERSION) return;
  } catch {
    // settings-tabellen finns inte än (tom databas) – kör full init.
  }

  const tables = [
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      jersey_number INTEGER,
      notes TEXT DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      strengths TEXT DEFAULT '',
      development_goals TEXT DEFAULT '',
      coach_name TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS evaluation_scores (
      evaluation_id INTEGER NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
      skill_id TEXT NOT NULL,
      level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 4),
      PRIMARY KEY (evaluation_id, skill_id)
    )`,
    `CREATE TABLE IF NOT EXISTS matches (
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
    )`,
    `CREATE TABLE IF NOT EXISTS match_players (
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      minutes INTEGER NOT NULL DEFAULT 0,
      goals INTEGER NOT NULL DEFAULT 0,
      assists INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (match_id, player_id)
    )`,
    `CREATE TABLE IF NOT EXISTS match_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      stat_id TEXT NOT NULL,
      match_second INTEGER,
      period INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_match_events_match ON match_events(match_id)`,
    `CREATE TABLE IF NOT EXISTS match_reporters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      stats TEXT NOT NULL DEFAULT '[]',
      UNIQUE(match_id, name)
    )`,
    `CREATE TABLE IF NOT EXISTS match_squad (
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      PRIMARY KEY (match_id, player_id)
    )`,
    `CREATE TABLE IF NOT EXISTS match_lineup (
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      x REAL NOT NULL,
      y REAL NOT NULL,
      PRIMARY KEY (match_id, player_id)
    )`,
    `CREATE TABLE IF NOT EXISTS match_subs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      off_player INTEGER REFERENCES players(id) ON DELETE SET NULL,
      on_player INTEGER REFERENCES players(id) ON DELETE SET NULL,
      match_second INTEGER,
      period INTEGER,
      created_at INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS player_self_evals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      fun_rating INTEGER NOT NULL DEFAULT 2,
      progress_rating INTEGER NOT NULL DEFAULT 2,
      team_rating INTEGER NOT NULL DEFAULT 2,
      best_at TEXT NOT NULL DEFAULT '',
      want_to_improve TEXT NOT NULL DEFAULT '',
      note_to_coach TEXT NOT NULL DEFAULT ''
    )`,
    `CREATE TABLE IF NOT EXISTS player_interviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_name TEXT NOT NULL,
      position TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      messages TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coach_name TEXT NOT NULL,
      action TEXT NOT NULL,
      subject TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS login_throttle (
      ip TEXT PRIMARY KEY,
      fails INTEGER NOT NULL DEFAULT 0,
      window_start INTEGER NOT NULL DEFAULT 0,
      blocked_until INTEGER NOT NULL DEFAULT 0
    )`,
    // Matchbetyg (ELO-form): ett betyg per spelare/match. overall = "mot
    // förväntan"-stegets nyckel, scores = JSON med ev. områdesbetyg (avancerat),
    // suggested = appens förslag, delta = form-förändringen. Se lib/rating.ts.
    `CREATE TABLE IF NOT EXISTS match_ratings (
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      overall TEXT NOT NULL,
      scores TEXT NOT NULL DEFAULT '{}',
      suggested TEXT NOT NULL DEFAULT '',
      delta INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (match_id, player_id)
    )`,
  ];
  for (const sql of tables) await (await getClient()).execute(sql);

  // Migrationer – körs om utan att fela på redan gjorda ändringar
  const migrations = [
    `ALTER TABLE match_players ADD COLUMN shots INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE match_players ADD COLUMN shots_on_target INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE match_players ADD COLUMN passes_completed INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE match_players ADD COLUMN interceptions INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE match_players ADD COLUMN saves INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE matches ADD COLUMN code TEXT`,
    `ALTER TABLE matches ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'`,
    `ALTER TABLE matches ADD COLUMN external_uid TEXT`,
    `ALTER TABLE matches ADD COLUMN clock_started_at INTEGER`,
    `ALTER TABLE matches ADD COLUMN clock_offset INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE matches ADD COLUMN clock_running INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE matches ADD COLUMN clock_period INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE match_events ADD COLUMN period INTEGER`,
    `ALTER TABLE matches ADD COLUMN start_time TEXT`,
    `ALTER TABLE matches ADD COLUMN periods INTEGER NOT NULL DEFAULT 3`,
    `ALTER TABLE matches ADD COLUMN period_minutes INTEGER NOT NULL DEFAULT 20`,
    `ALTER TABLE matches ADD COLUMN finished INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE match_events ADD COLUMN created_at INTEGER`,
    `ALTER TABLE match_reporters ADD COLUMN last_seen INTEGER`,
    `ALTER TABLE players ADD COLUMN position TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE players ADD COLUMN share_token TEXT`,
    `ALTER TABLE players ADD COLUMN share_expires INTEGER`,
    `ALTER TABLE players ADD COLUMN share_summary TEXT`,
    `ALTER TABLE players ADD COLUMN level TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE matches ADD COLUMN level TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE matches ADD COLUMN cup_name TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE matches ADD COLUMN formation TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE matches ADD COLUMN cup_phase TEXT NOT NULL DEFAULT 'group'`,
    `ALTER TABLE matches ADD COLUMN cup_round TEXT`,
    `ALTER TABLE matches ADD COLUMN report_open INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE match_players ADD COLUMN yellow_card INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE match_players ADD COLUMN red_card INTEGER NOT NULL DEFAULT 0`,
    // Vem som loggade händelsen – gör duplikatskyddet per rapportör så att två
    // personer kan räkna samma statistik (t.ex. mål) utan att blockera varandra.
    `ALTER TABLE match_events ADD COLUMN reporter TEXT`,
    `ALTER TABLE player_interviews ADD COLUMN interview_type TEXT NOT NULL DEFAULT 'spelarsamtal'`,
    `ALTER TABLE player_interviews ADD COLUMN scores TEXT NOT NULL DEFAULT '{}'`,
    `ALTER TABLE players ADD COLUMN pin TEXT`,
    // Löpande form-tal (ELO) – NULL tills spelaren betygsatts första gången, då
    // det seedas från spelarens nivå. Se lib/rating.ts.
    `ALTER TABLE players ADD COLUMN form_rating INTEGER`,
    `ALTER TABLE matches ADD COLUMN cup_group TEXT NOT NULL DEFAULT ''`,
  ];
  for (const sql of migrations) await tryExec(sql);

  await tryExec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_code ON matches(code) WHERE code IS NOT NULL`
  );
  await tryExec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_players_token ON players(share_token) WHERE share_token IS NOT NULL`
  );
  await tryExec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_uid ON matches(external_uid) WHERE external_uid IS NOT NULL`
  );

  // Seed – inställningar
  const settingsCount = await (await getClient()).execute("SELECT COUNT(*) AS c FROM settings");
  if (Number(settingsCount.rows[0].c) === 0) {
    const defaults: [string, string][] = [
      ["club_name", "Bollstanäs SK"],
      ["team_name", "BSK F2014"],
      ["birth_year", "2014"],
      ["primary_color", "#13306e"],
      ["accent_color", "#ffd23f"],
      ["coach_code", "TRANARE2014"],
      ["season", "2026"],
    ];
    for (const [k, v] of defaults) {
      await (await getClient()).execute({ sql: "INSERT INTO settings (key, value) VALUES (?, ?)", args: [k, v] });
    }
  }
  await (await getClient()).execute(
    "INSERT OR IGNORE INTO settings (key, value) VALUES ('calendar_url', '')"
  );
  await (await getClient()).execute(
    "INSERT OR IGNORE INTO settings (key, value) VALUES ('allowed_coach_emails', '')"
  );
  // Matchtröjefärger – seedas för redan installerade appar utan att skriva över
  const jerseyDefaults: [string, string][] = [
    ["jersey_color", "#ffd23f"],
    ["jersey_text_color", "#111111"],
    ["gk_jersey_color", "#1f9d57"],
    ["gk_jersey_text_color", "#ffffff"],
  ];
  for (const [k, v] of jerseyDefaults) {
    await (await getClient()).execute({
      sql: "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
      args: [k, v],
    });
  }

  // Seed – exempelspelare
  const playerCount = await (await getClient()).execute("SELECT COUNT(*) AS c FROM players");
  if (Number(playerCount.rows[0].c) === 0) {
    const demo = [
      "Exempel: Alva", "Exempel: Ebba", "Exempel: Elsa", "Exempel: Freja",
      "Exempel: Lilly", "Exempel: Maja", "Exempel: Nora", "Exempel: Saga",
      "Exempel: Stella", "Exempel: Vera",
    ];
    for (let i = 0; i < demo.length; i++) {
      await (await getClient()).execute({
        sql: "INSERT INTO players (name, jersey_number) VALUES (?, ?)",
        args: [demo[i], i + 2],
      });
    }
  }

  // Stämpla schemat som aktuellt så nästa kalla start hoppar över allt ovan.
  await (await getClient()).execute({
    sql: "INSERT INTO settings (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    args: [SCHEMA_VERSION],
  });
}

let readyPromise: Promise<void> | null = null;
function ready(): Promise<void> {
  if (!readyPromise) readyPromise = init();
  return readyPromise;
}

function rowToObject<T>(columns: string[], row: Record<string, unknown>): T {
  return Object.fromEntries(columns.map((c) => [c, row[c]])) as T;
}

// ---- Frågehjälpare ----

export async function all<T>(sql: string, args: InArgs = []): Promise<T[]> {
  await ready();
  const res = await (await getClient()).execute({ sql, args });
  return res.rows.map((r) => rowToObject<T>(res.columns, r as unknown as Record<string, unknown>));
}

export async function get<T>(sql: string, args: InArgs = []): Promise<T | undefined> {
  const rows = await all<T>(sql, args);
  return rows[0];
}

export async function run(sql: string, args: InArgs = []): Promise<ResultSet> {
  await ready();
  return (await getClient()).execute({ sql, args });
}

// Flera skrivningar i en transaktion
export async function batch(statements: { sql: string; args?: InArgs }[]): Promise<void> {
  await ready();
  if (statements.length === 0) return;
  await (await getClient()).batch(
    statements.map((s) => ({ sql: s.sql, args: s.args ?? [] })),
    "write"
  );
}

// ---- Inställningar ----

export async function getSetting(key: string): Promise<string> {
  const row = await get<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key]);
  return row?.value ?? "";
}

export async function setSetting(key: string, value: string): Promise<void> {
  await run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value]
  );
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await all<{ key: string; value: string }>("SELECT key, value FROM settings");
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// ---- Aktivitetslogg ----

export type ActivityEntry = {
  id: number;
  coach_name: string;
  action: string;
  subject: string;
  created_at: string;
};

export async function logActivity(coachName: string, action: string, subject: string): Promise<void> {
  await run(
    "INSERT INTO activity_log (coach_name, action, subject) VALUES (?, ?, ?)",
    [coachName.slice(0, 60), action.slice(0, 80), subject.slice(0, 100)]
  );
}

export async function getRecentActivity(limit = 10): Promise<ActivityEntry[]> {
  return all<ActivityEntry>(
    "SELECT id, coach_name, action, subject, created_at FROM activity_log ORDER BY id DESC LIMIT ?",
    [limit]
  );
}
