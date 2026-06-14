// Serverlogik för live-rapporteringen: matchklocka, händelser och räknare.
// Skrivningar batchas i transaktioner för att undvika konflikter vid parallell rapportering.

import { all, get, run, batch } from "./db";
import { STAT_IDS, LIVE_COUNT_IDS } from "./stats";
import { OPPONENT_GOAL, LiveState, LiveEvent, Reporter, SubEntry } from "./liveTypes";

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
  cup_name: string;
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

  const todayLocal = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD i svensk tidszon

  // Nollställ felaktigt satt finished-flagga för framtida matcher (kan hända om
  // tränaren råkade trycka "Avsluta match" på en kommande cup-match).
  if (m.finished && m.date > todayLocal) {
    await run("UPDATE matches SET finished = 0, clock_running = 0, clock_started_at = NULL WHERE id = ?", [matchId]);
    m = { ...m, finished: 0, clock_running: 0, clock_started_at: null };
  }

  // Auto-avslut baserat på verklig tid – bara om matchen är idag eller tidigare.
  if (!m.finished && m.start_time && m.date <= todayLocal) {
    const [h, min] = m.start_time.split(":").map(Number);
    // Konstruera starttiden i svensk lokal tid (UTC+2 sommartid)
    const matchStart = new Date(`${m.date}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00+02:00`);
    const totalMinutes = (m.periods ?? 3) * (m.period_minutes ?? 20) + 5;
    const expectedEnd = new Date(matchStart.getTime() + totalMinutes * 60000);
    if (Date.now() > expectedEnd.getTime()) {
      await run("UPDATE matches SET finished = 1, clock_running = 0, clock_started_at = NULL WHERE id = ?", [matchId]);
      m = { ...m, finished: 1, clock_running: 0, clock_started_at: null };
    }
  }

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
    counts[row.player_id] = Object.fromEntries(LIVE_COUNT_IDS.map((s) => [s, row[s] ?? 0]));
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

  // Byten, startelva och speltid
  const nameById = new Map(players.map((p) => [p.id, p.name]));
  const subRows = await all<{ id: number; off_player: number | null; on_player: number | null; match_second: number | null; period: number | null }>(
    "SELECT id, off_player, on_player, match_second, period FROM match_subs WHERE match_id = ? ORDER BY id",
    [matchId]
  );
  const subs: SubEntry[] = subRows.map((s) => ({
    id: s.id,
    offId: s.off_player,
    offName: s.off_player != null ? nameById.get(s.off_player) ?? null : null,
    onId: s.on_player,
    onName: s.on_player != null ? nameById.get(s.on_player) ?? null : null,
    second: s.match_second,
    period: s.period,
  }));

  const starterRows = await all<{ player_id: number }>(
    "SELECT player_id FROM match_lineup WHERE match_id = ?",
    [matchId]
  );
  const starters = starterRows.map((r) => r.player_id);
  const periodSec = (m.period_minutes ?? 20) * 60;
  const nowAbs = ((m.clock_period ?? 1) - 1) * periodSec + clockSeconds(m);
  const { minutes, onField } = computePlaytime(starters, subRows, nowAbs, periodSec);

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
    subs,
    minutes,
    onField,
    hasLineup: starters.length > 0,
  };
}

// Speltid per spelare utifrån startelva + byten + nuvarande matchtid.
// Returnerar även vilka som är på plan just nu. Kräver att en startelva finns.
function computePlaytime(
  starters: number[],
  subRows: { id: number; off_player: number | null; on_player: number | null; match_second: number | null; period: number | null }[],
  nowAbs: number,
  periodSec: number
): { minutes: Record<number, number>; onField: number[] } {
  if (starters.length === 0) return { minutes: {}, onField: [] };
  const abs = (s: { period: number | null; match_second: number | null }) =>
    ((s.period ?? 1) - 1) * periodSec + (s.match_second ?? 0);
  const onSince = new Map<number, number | null>();
  for (const id of starters) onSince.set(id, 0);
  const totalSec = new Map<number, number>();
  for (const id of starters) totalSec.set(id, 0);

  const sorted = [...subRows].sort((a, b) => abs(a) - abs(b) || a.id - b.id);
  for (const s of sorted) {
    const t = Math.min(abs(s), nowAbs);
    if (s.off_player != null) {
      const since = onSince.get(s.off_player);
      if (since != null) {
        totalSec.set(s.off_player, (totalSec.get(s.off_player) ?? 0) + Math.max(0, t - since));
        onSince.set(s.off_player, null);
      }
    }
    if (s.on_player != null && (onSince.get(s.on_player) ?? null) == null) {
      onSince.set(s.on_player, t);
      if (!totalSec.has(s.on_player)) totalSec.set(s.on_player, 0);
    }
  }
  const onField: number[] = [];
  for (const [id, since] of onSince) {
    if (since != null) {
      totalSec.set(id, (totalSec.get(id) ?? 0) + Math.max(0, nowAbs - since));
      onField.push(id);
    }
  }
  const minutes: Record<number, number> = {};
  for (const [id, sec] of totalSec) minutes[id] = Math.max(0, Math.round(sec / 60));
  return { minutes, onField };
}

export async function finishMatch(matchId: number): Promise<void> {
  await run(
    "UPDATE matches SET finished = 1, clock_running = 0, clock_started_at = NULL WHERE id = ?",
    [matchId]
  );
}

export async function claimStats(matchId: number, name: string, stats: string[]): Promise<void> {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return;
  const now = Math.floor(Date.now() / 1000);
  // Skiftlägesokänsligt: återanvänd en redan registrerad rapportör med samma
  // namn oavsett stora/små bokstäver ("Itzas Pappa" == "itzas pappa").
  const existing = await get<{ name: string }>(
    "SELECT name FROM match_reporters WHERE match_id = ? AND name = ? COLLATE NOCASE",
    [matchId, trimmed]
  );
  const finalName = existing?.name ?? trimmed;
  await run(
    `INSERT INTO match_reporters (match_id, name, stats, last_seen)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(match_id, name) DO UPDATE SET stats = excluded.stats, last_seen = excluded.last_seen`,
    [matchId, finalName, JSON.stringify(stats), now]
  );
}

const ENSURE_ROW =
  "INSERT INTO match_players (match_id, player_id) VALUES (?, ?) ON CONFLICT(match_id, player_id) DO NOTHING";

export async function recordEvent(
  matchId: number,
  playerId: number | null,
  statId: string,
  reporter: string | null = null
) {
  if (statId !== OPPONENT_GOAL && !LIVE_COUNT_IDS.includes(statId)) throw new Error("Okänd statistik");
  const m = (await get<MatchRow>("SELECT * FROM matches WHERE id = ?", [matchId]))!;
  const now = Math.floor(Date.now() / 1000);

  // Dubbeltrycksskydd per rapportör: slår bara ihop när SAMMA rapportör trycker
  // samma sak på samma spelare inom 8 sekunder (fettfinger). Olika rapportörer
  // blockerar aldrig varandra – två personer kan räkna mål samtidigt.
  const rep = reporter && reporter.trim() ? reporter.trim() : null;
  const recent = await get<{ id: number }>(
    `SELECT id FROM match_events
     WHERE match_id = ? AND player_id IS ? AND stat_id = ? AND reporter IS ? AND created_at > ?
     LIMIT 1`,
    [matchId, playerId, statId, rep, now - 8]
  );
  if (recent) return;

  const clockTouched = m.clock_running || m.clock_offset > 0 || (m.clock_period ?? 1) > 1;
  const second = clockTouched ? clockSeconds(m) : null;
  const period = clockTouched ? (m.clock_period ?? 1) : null;

  const stmts: { sql: string; args?: (string | number | null)[] }[] = [
    {
      sql: "INSERT INTO match_events (match_id, player_id, stat_id, match_second, period, created_at, reporter) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [matchId, playerId, statId, second, period, now, rep],
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
  } else if (last.player_id != null && LIVE_COUNT_IDS.includes(last.stat_id)) {
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

// Logga ett byte (ut → in) vid aktuell matchtid. Inkommande spelare markeras
// som spelad så hen syns i statistiken.
export async function recordSub(matchId: number, offId: number, onId: number) {
  if (!offId || !onId || offId === onId) return;
  const m = (await get<MatchRow>("SELECT * FROM matches WHERE id = ?", [matchId]))!;
  const now = Math.floor(Date.now() / 1000);
  const clockTouched = m.clock_running || m.clock_offset > 0 || (m.clock_period ?? 1) > 1;
  const second = clockTouched ? clockSeconds(m) : null;
  const period = clockTouched ? (m.clock_period ?? 1) : null;

  await batch([
    {
      sql: "INSERT INTO match_subs (match_id, off_player, on_player, match_second, period, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      args: [matchId, offId, onId, second, period, now],
    },
    { sql: ENSURE_ROW, args: [matchId, onId] },
  ]);
}

export async function undoLastSub(matchId: number) {
  const last = await get<{ id: number }>(
    "SELECT id FROM match_subs WHERE match_id = ? ORDER BY id DESC LIMIT 1",
    [matchId]
  );
  if (last) await run("DELETE FROM match_subs WHERE id = ?", [last.id]);
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
