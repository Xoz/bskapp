// Serverlogik för live-rapporteringen: matchklocka, händelser och räknare.
// All skrivning går genom transaktioner så att flera föräldrar kan rapportera samtidigt.

import db from "./db";
import { STAT_IDS } from "./stats";
import { OPPONENT_GOAL, LiveState, LiveEvent } from "./liveTypes";

interface MatchRow {
  id: number;
  opponent: string;
  home_away: string;
  date: string;
  our_score: number | null;
  opponent_score: number | null;
  clock_started_at: number | null;
  clock_offset: number;
  clock_running: number;
}

export function getMatchRowByCode(code: string): MatchRow | undefined {
  return db.prepare("SELECT * FROM matches WHERE code = ?").get(code) as MatchRow | undefined;
}

export function clockSeconds(m: MatchRow): number {
  const base = m.clock_offset ?? 0;
  if (m.clock_running && m.clock_started_at) {
    return base + Math.max(0, Math.floor(Date.now() / 1000) - m.clock_started_at);
  }
  return base;
}

export function getLiveState(matchId: number): LiveState {
  const m = db.prepare("SELECT * FROM matches WHERE id = ?").get(matchId) as MatchRow;

  const players = db
    .prepare("SELECT id, name, jersey_number FROM players WHERE active = 1 ORDER BY name COLLATE NOCASE")
    .all() as LiveState["players"];

  const mpRows = db
    .prepare("SELECT * FROM match_players WHERE match_id = ?")
    .all(matchId) as Record<string, number>[];

  const counts: LiveState["counts"] = {};
  const played: number[] = [];
  for (const row of mpRows) {
    played.push(row.player_id);
    counts[row.player_id] = Object.fromEntries(STAT_IDS.map((s) => [s, row[s] ?? 0]));
  }

  const events = db
    .prepare(
      `SELECT e.id, e.player_id, p.name AS player_name, e.stat_id, e.match_second
       FROM match_events e LEFT JOIN players p ON p.id = e.player_id
       WHERE e.match_id = ? ORDER BY e.id DESC LIMIT 200`
    )
    .all(matchId) as LiveEvent[];

  return {
    matchId: m.id,
    opponent: m.opponent,
    homeAway: m.home_away,
    date: m.date,
    ourScore: m.our_score ?? 0,
    oppScore: m.opponent_score ?? 0,
    clockRunning: !!m.clock_running,
    clockSeconds: clockSeconds(m),
    players,
    counts,
    played,
    events,
  };
}

const ensureRow = db.prepare(
  `INSERT INTO match_players (match_id, player_id) VALUES (?, ?)
   ON CONFLICT(match_id, player_id) DO NOTHING`
);

export function recordEvent(matchId: number, playerId: number | null, statId: string) {
  if (statId !== OPPONENT_GOAL && !STAT_IDS.includes(statId)) throw new Error("Okänd statistik");
  const m = db.prepare("SELECT * FROM matches WHERE id = ?").get(matchId) as MatchRow;
  const second = m.clock_running || m.clock_offset > 0 ? clockSeconds(m) : null;

  const tx = db.transaction(() => {
    db.prepare(
      "INSERT INTO match_events (match_id, player_id, stat_id, match_second) VALUES (?, ?, ?, ?)"
    ).run(matchId, playerId, statId, second);

    if (statId === OPPONENT_GOAL) {
      db.prepare(
        "UPDATE matches SET opponent_score = COALESCE(opponent_score, 0) + 1 WHERE id = ?"
      ).run(matchId);
      return;
    }
    if (playerId == null) return;
    ensureRow.run(matchId, playerId);
    db.prepare(
      `UPDATE match_players SET ${statId} = ${statId} + 1 WHERE match_id = ? AND player_id = ?`
    ).run(matchId, playerId);
    if (statId === "goals") {
      db.prepare("UPDATE matches SET our_score = COALESCE(our_score, 0) + 1 WHERE id = ?").run(matchId);
    }
  });
  tx();
}

export function undoLastEvent(matchId: number) {
  const last = db
    .prepare("SELECT * FROM match_events WHERE match_id = ? ORDER BY id DESC LIMIT 1")
    .get(matchId) as { id: number; player_id: number | null; stat_id: string } | undefined;
  if (!last) return;

  const tx = db.transaction(() => {
    db.prepare("DELETE FROM match_events WHERE id = ?").run(last.id);

    if (last.stat_id === OPPONENT_GOAL) {
      db.prepare(
        "UPDATE matches SET opponent_score = MAX(COALESCE(opponent_score, 0) - 1, 0) WHERE id = ?"
      ).run(matchId);
      return;
    }
    if (last.player_id == null || !STAT_IDS.includes(last.stat_id)) return;
    db.prepare(
      `UPDATE match_players SET ${last.stat_id} = MAX(${last.stat_id} - 1, 0) WHERE match_id = ? AND player_id = ?`
    ).run(matchId, last.player_id);
    if (last.stat_id === "goals") {
      db.prepare("UPDATE matches SET our_score = MAX(COALESCE(our_score, 0) - 1, 0) WHERE id = ?").run(matchId);
    }
  });
  tx();
}

export function setClock(matchId: number, op: "start" | "pause" | "reset") {
  const m = db.prepare("SELECT * FROM matches WHERE id = ?").get(matchId) as MatchRow;
  const now = Math.floor(Date.now() / 1000);

  if (op === "start" && !m.clock_running) {
    db.prepare("UPDATE matches SET clock_running = 1, clock_started_at = ? WHERE id = ?").run(now, matchId);
  } else if (op === "pause" && m.clock_running) {
    db.prepare(
      "UPDATE matches SET clock_running = 0, clock_offset = ?, clock_started_at = NULL WHERE id = ?"
    ).run(clockSeconds(m), matchId);
  } else if (op === "reset") {
    db.prepare(
      "UPDATE matches SET clock_running = 0, clock_offset = 0, clock_started_at = NULL WHERE id = ?"
    ).run(matchId);
  }
}

export function togglePlayed(matchId: number, playerId: number) {
  const row = db
    .prepare("SELECT * FROM match_players WHERE match_id = ? AND player_id = ?")
    .get(matchId, playerId) as Record<string, number> | undefined;
  if (!row) {
    ensureRow.run(matchId, playerId);
    return;
  }
  // Ta bara bort raden om all statistik är noll – annars skulle siffror gå förlorade
  const hasStats = STAT_IDS.some((s) => (row[s] ?? 0) > 0);
  if (!hasStats) {
    db.prepare("DELETE FROM match_players WHERE match_id = ? AND player_id = ?").run(matchId, playerId);
  }
}
