// Serverlogik för live-rapporteringen: matchklocka, händelser och räknare.
// Skrivningar batchas i transaktioner så att flera föräldrar kan rapportera samtidigt.

import { all, get, run, batch } from "./db";
import { STAT_IDS } from "./stats";
import { OPPONENT_GOAL, LiveState, LiveEvent, Reporter } from "./liveTypes";

interface MatchRow {
  id: number;
  opponent: string;
  home_away: string;
  date: string;
  start_time: string | null;
  periods: number;
  period_minutes: number;
  our_score: number | null;
  opponent_score: number | null;
  clock_started_at: number | null;
  clock_offset: number;
  clock_running: number;
  clock_period: number;
  finished: number;
}

export async function getMatchRowByCode(code: string): Promise<MatchRow | undefined> {
  return get<MatchRow>("SELECT * FROM matches WHERE code = ?", [code]);
}

export function clockSeconds(m: MatchRow): number {
  const base = m.clock_offset ?? 0;
  if (m.clock_running && m.clock_started_at) {
    return base + Math.max(0, Math.floor(Date.now() / 1000) - m.clock_started_at);
  }
  return base;
}

export async function getLiveState(matchId: number): Promise<LiveState> {
  let m = (await get<MatchRow>("SELECT * FROM matches WHERE id = ?", [matchId]))!;

  // Auto-avslut baserat på verklig tid – om avsparktid är satt och matchen borde vara klar
  if (!m.finished && m.start_time) {
    const [h, min] = m.start_time.split(":").map(Number);
    const matchStart = new Date(`${m.date}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`);
    const totalMinutes = (m.periods ?? 3) * (m.period_minutes ?? 20) + 5;
    const expectedEnd = new Date(matchStart.getTime() + totalMinutes * 60000);
    if (Date.now() > expectedEnd.getTime()) {
      await run("UPDATE matches SET finished = 1, clock_running = 0, clock_started_at = NULL WHERE id = ?", [matchId]);
      m = { ...m, finished: 1, clock_running: 0, clock_started_at: null };
    }
  };

  const players = await all<LiveState["players"][number]>(
    "SELECT id, name, jersey_number FROM players WHERE active = 1 ORDER BY name COLLATE NOCASE"
  );

  const mpRows = await all<Record<string, number>>(
    "SELECT * FROM match_players WHERE match_id = ?",
    [matchId]
  );

  const counts: LiveState["counts"] = {};
  const played: number[] = [];
  for (const row of mpRows) {
    played.push(row.player_id);
    counts[row.player_id] = Object.fromEntries(STAT_IDS.map((s) => [s, row[s] ?? 0]));
  }

  const events = await all<LiveEvent>(
    `SELECT e.id, e.player_id, p.name AS player_name, e.stat_id, e.match_second, e.period
     FROM match_events e LEFT JOIN players p ON p.id = e.player_id
     WHERE e.match_id = ? ORDER BY e.id DESC LIMIT 200`,
    [matchId]
  );

  const reporterRows = await all<{ name: string; stats: string; last_seen: number | null }>(
    "SELECT name, stats, last_seen FROM match_reporters WHERE match_id = ?",
    [matchId]
  );
  const reporters: Reporter[] = reporterRows.map((r) => ({
    name: r.name,
    stats: JSON.parse(r.stats) as string[],
    lastSeen: r.last_seen ?? null,
  }));

  return {
    matchId: m.id,
    opponent: m.opponent,
    homeAway: m.home_away,
    date: m.date,
    ourScore: m.our_score ?? 0,
    oppScore: m.opponent_score ?? 0,
    clockRunning: !!m.clock_running,
    clockSeconds: clockSeconds(m),
    period: m.clock_period ?? 1,
    players,
    counts,
    startTime: m.start_time ?? null,
    periods: m.periods ?? 3,
    periodMinutes: m.period_minutes ?? 20,
    played,
    events,
    reporters,
    finished: !!m.finished,
  };
}

export async function finishMatch(matchId: number): Promise<void> {
  await run(
    "UPDATE matches SET finished = 1, clock_running = 0, clock_started_at = NULL WHERE id = ?",
    [matchId]
  );
}

export async function claimStats(matchId: number, name: string, stats: string[]): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const now = Math.floor(Date.now() / 1000);
  await run(
    `INSERT INTO match_reporters (match_id, name, stats, last_seen)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(match_id, name) DO UPDATE SET stats = excluded.stats, last_seen = excluded.last_seen`,
    [matchId, trimmed, JSON.stringify(stats), now]
  );
}

const ENSURE_ROW =
  "INSERT INTO match_players (match_id, player_id) VALUES (?, ?) ON CONFLICT(match_id, player_id) DO NOTHING";

export async function recordEvent(matchId: number, playerId: number | null, statId: string) {
  if (statId !== OPPONENT_GOAL && !STAT_IDS.includes(statId)) throw new Error("Okänd statistik");
  const m = (await get<MatchRow>("SELECT * FROM matches WHERE id = ?", [matchId]))!;
  const now = Math.floor(Date.now() / 1000);

  // 15-sekunders dedup: ignorera om identisk händelse redan finns
  const recent = await get<{ id: number }>(
    `SELECT id FROM match_events
     WHERE match_id = ? AND player_id IS ? AND stat_id = ? AND created_at > ?
     LIMIT 1`,
    [matchId, playerId, statId, now - 15]
  );
  if (recent) return;

  const clockTouched = m.clock_running || m.clock_offset > 0 || (m.clock_period ?? 1) > 1;
  const second = clockTouched ? clockSeconds(m) : null;
  const period = clockTouched ? (m.clock_period ?? 1) : null;

  const stmts: { sql: string; args?: (string | number | null)[] }[] = [
    {
      sql: "INSERT INTO match_events (match_id, player_id, stat_id, match_second, period, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      args: [matchId, playerId, statId, second, period, now],
    },
  ];

  if (statId === OPPONENT_GOAL) {
    stmts.push({
      sql: "UPDATE matches SET opponent_score = COALESCE(opponent_score, 0) + 1 WHERE id = ?",
      args: [matchId],
    });
  } else if (playerId != null) {
    stmts.push({ sql: ENSURE_ROW, args: [matchId, playerId] });
    stmts.push({
      sql: `UPDATE match_players SET ${statId} = ${statId} + 1 WHERE match_id = ? AND player_id = ?`,
      args: [matchId, playerId],
    });
    if (statId === "goals") {
      stmts.push({
        sql: "UPDATE matches SET our_score = COALESCE(our_score, 0) + 1 WHERE id = ?",
        args: [matchId],
      });
    }
  }
  await batch(stmts);
}

export async function undoLastEvent(matchId: number) {
  const last = await get<{ id: number; player_id: number | null; stat_id: string }>(
    "SELECT * FROM match_events WHERE match_id = ? ORDER BY id DESC LIMIT 1",
    [matchId]
  );
  if (!last) return;

  const stmts: { sql: string; args?: (string | number | null)[] }[] = [
    { sql: "DELETE FROM match_events WHERE id = ?", args: [last.id] },
  ];

  if (last.stat_id === OPPONENT_GOAL) {
    stmts.push({
      sql: "UPDATE matches SET opponent_score = MAX(COALESCE(opponent_score, 0) - 1, 0) WHERE id = ?",
      args: [matchId],
    });
  } else if (last.player_id != null && STAT_IDS.includes(last.stat_id)) {
    stmts.push({
      sql: `UPDATE match_players SET ${last.stat_id} = MAX(${last.stat_id} - 1, 0) WHERE match_id = ? AND player_id = ?`,
      args: [matchId, last.player_id],
    });
    if (last.stat_id === "goals") {
      stmts.push({
        sql: "UPDATE matches SET our_score = MAX(COALESCE(our_score, 0) - 1, 0) WHERE id = ?",
        args: [matchId],
      });
    }
  }
  await batch(stmts);
}

export async function setClock(matchId: number, op: "start" | "pause" | "reset" | "next_period") {
  const m = (await get<MatchRow>("SELECT * FROM matches WHERE id = ?", [matchId]))!;
  const now = Math.floor(Date.now() / 1000);

  if (op === "start" && !m.clock_running) {
    await run("UPDATE matches SET clock_running = 1, clock_started_at = ? WHERE id = ?", [
      now,
      matchId,
    ]);
  } else if (op === "pause" && m.clock_running) {
    await run(
      "UPDATE matches SET clock_running = 0, clock_offset = ?, clock_started_at = NULL WHERE id = ?",
      [clockSeconds(m), matchId]
    );
  } else if (op === "next_period" && (m.clock_period ?? 1) < (m.periods ?? 3)) {
    // Ny period: nollställ periodklockan och starta direkt
    await run(
      "UPDATE matches SET clock_period = ?, clock_running = 1, clock_offset = 0, clock_started_at = ? WHERE id = ?",
      [(m.clock_period ?? 1) + 1, now, matchId]
    );
  } else if (op === "reset") {
    await run(
      "UPDATE matches SET clock_running = 0, clock_offset = 0, clock_started_at = NULL, clock_period = 1 WHERE id = ?",
      [matchId]
    );
  }
}

export async function togglePlayed(matchId: number, playerId: number) {
  const row = await get<Record<string, number>>(
    "SELECT * FROM match_players WHERE match_id = ? AND player_id = ?",
    [matchId, playerId]
  );
  if (!row) {
    await run(ENSURE_ROW, [matchId, playerId]);
    return;
  }
  // Ta bara bort raden om all statistik är noll – annars skulle siffror gå förlorade
  const hasStats = STAT_IDS.some((s) => (row[s] ?? 0) > 0);
  if (!hasStats) {
    await run("DELETE FROM match_players WHERE match_id = ? AND player_id = ?", [
      matchId,
      playerId,
    ]);
  }
}
