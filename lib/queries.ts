import crypto from "crypto";
import { all, get, run } from "./db";
import { ALL_SKILLS, CATEGORIES } from "./svff";
import { STAT_IDS } from "./stats";

export interface Player {
  id: number;
  name: string;
  jersey_number: number | null;
  notes: string;
  active: number;
  position: string;
  share_token: string | null;
  share_expires: number | null;
  share_summary: string | null;
  level: string;
}

// Spelarlänkar gäller i 48 timmar – tänkta att aktiveras inför ett spelarsamtal
export const SHARE_TTL_MS = 48 * 60 * 60 * 1000;

export interface Evaluation {
  id: number;
  player_id: number;
  date: string;
  strengths: string;
  development_goals: string;
  coach_name: string;
}

export interface Match {
  id: number;
  date: string;
  start_time: string | null;
  periods: number;
  period_minutes: number;
  opponent: string;
  home_away: string;
  match_type: string;
  our_score: number | null;
  opponent_score: number | null;
  notes: string;
  code: string;
  source: string;
  finished: number;
  level: string;
  cup_name: string;
  formation: string;
}

// Matcher som ingår i samma cup/turnering (samma cup_name)
export async function getMatchesByCup(cupName: string): Promise<Match[]> {
  if (!cupName) return [];
  return all<Match>(
    "SELECT * FROM matches WHERE cup_name = ? ORDER BY date, start_time, id",
    [cupName]
  );
}

// Alla matcher i pågående cuper. En cup är pågående t.o.m. dagen efter dess
// sista match (today <= sista dagen + 1  ⇔  sista dagen >= today − 1 = yesterday),
// och först fr.o.m. dess första dag (första dagen <= today).
export async function getActiveCupMatches(today: string, yesterday: string): Promise<Match[]> {
  return all<Match>(
    `SELECT * FROM matches
     WHERE cup_name <> ''
       AND cup_name IN (
         SELECT cup_name FROM matches WHERE cup_name <> ''
         GROUP BY cup_name
         HAVING MIN(date) <= ? AND MAX(date) >= ?
       )
     ORDER BY cup_name, date, start_time, id`,
    [today, yesterday]
  );
}

export interface MatchPlayerRow {
  match_id: number;
  player_id: number;
  goals: number;
  assists: number;
  shots: number;
  shots_on_target: number;
  passes_completed: number;
  interceptions: number;
  saves: number;
}

export async function getPlayers(): Promise<Player[]> {
  return all<Player>("SELECT * FROM players WHERE active = 1 ORDER BY name COLLATE NOCASE");
}

export async function getPlayer(id: number): Promise<Player | undefined> {
  return get<Player>("SELECT * FROM players WHERE id = ?", [id]);
}

export async function getPlayerByShareToken(token: string): Promise<Player | undefined> {
  return get<Player>("SELECT * FROM players WHERE share_token = ? AND active = 1", [token]);
}

// Skapar en ny, hemlig delningslänk som gäller i 48 timmar. Anropas av tränaren
// inför ett spelarsamtal. En ny token gör samtidigt alla tidigare länkar ogiltiga.
export async function renewShareToken(playerId: number): Promise<string> {
  const token = crypto.randomBytes(9).toString("base64url");
  const expires = Date.now() + SHARE_TTL_MS;
  await run("UPDATE players SET share_token = ?, share_expires = ? WHERE id = ?", [
    token,
    expires,
    playerId,
  ]);
  return token;
}

// Återkallar länken direkt (t.ex. efter avslutat samtal)
export async function revokeShareToken(playerId: number): Promise<void> {
  await run(
    "UPDATE players SET share_token = NULL, share_expires = NULL, share_summary = NULL WHERE id = ?",
    [playerId]
  );
}

export function shareLinkActive(player: Pick<Player, "share_token" | "share_expires">): boolean {
  return !!player.share_token && !!player.share_expires && player.share_expires > Date.now();
}

export async function getEvaluations(playerId: number): Promise<Evaluation[]> {
  return all<Evaluation>(
    "SELECT * FROM evaluations WHERE player_id = ? ORDER BY date DESC, id DESC",
    [playerId]
  );
}

export async function getScores(evaluationId: number): Promise<Record<string, number>> {
  const rows = await all<{ skill_id: string; level: number }>(
    "SELECT skill_id, level FROM evaluation_scores WHERE evaluation_id = ?",
    [evaluationId]
  );
  return Object.fromEntries(rows.map((r) => [r.skill_id, r.level]));
}

// Kategorisnitt per utvärdering, kronologiskt – för utvecklingsgrafen
export async function getPlayerDevelopment(playerId: number) {
  const evals = await all<Evaluation>(
    "SELECT * FROM evaluations WHERE player_id = ? ORDER BY date ASC, id ASC",
    [playerId]
  );
  const scoresPerEval = await Promise.all(evals.map((ev) => getScores(ev.id)));

  return evals.map((ev, i) => {
    const scores = scoresPerEval[i];
    const point: Record<string, number | string> = { date: ev.date };
    let total = 0;
    let count = 0;
    for (const cat of CATEGORIES) {
      const levels = cat.skills.map((s) => scores[s.id]).filter((v): v is number => v != null);
      if (levels.length > 0) {
        const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
        point[cat.id] = Math.round(avg * 100) / 100;
        total += levels.reduce((a, b) => a + b, 0);
        count += levels.length;
      }
    }
    if (count > 0) point.total = Math.round((total / count) * 100) / 100;
    return point;
  });
}

export async function getMatches(): Promise<Match[]> {
  return all<Match>("SELECT * FROM matches ORDER BY date DESC, id DESC");
}

export async function getMatch(id: number): Promise<Match | undefined> {
  return get<Match>("SELECT * FROM matches WHERE id = ?", [id]);
}

export async function getMatchByCode(code: string): Promise<Match | undefined> {
  return get<Match>("SELECT * FROM matches WHERE code = ?", [code]);
}

export async function getMatchPlayers(matchId: number): Promise<MatchPlayerRow[]> {
  return all<MatchPlayerRow>("SELECT * FROM match_players WHERE match_id = ?", [matchId]);
}

export interface SeasonStatRow {
  id: number;
  name: string;
  jersey_number: number | null;
  matches_played: number;
  goals: number;
  assists: number;
  shots: number;
  shots_on_target: number;
  passes_completed: number;
  interceptions: number;
  saves: number;
}

export interface PlayerMatchRow {
  match_id: number;
  date: string;
  opponent: string;
  home_away: string;
  our_score: number | null;
  opponent_score: number | null;
  goals: number;
  assists: number;
  shots: number;
  shots_on_target: number;
  passes_completed: number;
  interceptions: number;
  saves: number;
}

// En match räknas som spelad när den avslutats eller när dess datum passerat.
// Det filtrerar bort framtida matcher som råkat få en match_players-rad (t.ex.
// om någon öppnat live-rapporteringen i förväg) så de inte syns i statistiken.
const PLAYED_MATCH_SQL = "(m.finished = 1 OR m.date <= ?)";
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export async function getPlayerMatchStats(playerId: number): Promise<PlayerMatchRow[]> {
  return all<PlayerMatchRow>(
    `SELECT m.id AS match_id, m.date, m.opponent, m.home_away,
            m.our_score, m.opponent_score,
            mp.goals, mp.assists, mp.shots, mp.shots_on_target,
            mp.passes_completed, mp.interceptions, mp.saves
     FROM match_players mp
     JOIN matches m ON m.id = mp.match_id
     WHERE mp.player_id = ? AND ${PLAYED_MATCH_SQL}
     ORDER BY m.date DESC, m.id DESC`,
    [playerId, todayStr()]
  );
}

// Säsongsstatistik per spelare – deltagande (SvFF: alla ska spela) och insatser.
// Bara spelade matcher räknas, så siffran stämmer med spelarprofilen.
export async function getSeasonStats(): Promise<SeasonStatRow[]> {
  const sums = STAT_IDS.map((c) => `COALESCE(SUM(mp.${c}), 0) AS ${c}`).join(",\n              ");
  return all<SeasonStatRow>(
    `SELECT p.id, p.name, p.jersey_number,
            COUNT(mp.match_id) AS matches_played,
            ${sums}
     FROM players p
     LEFT JOIN (match_players mp JOIN matches m ON m.id = mp.match_id AND ${PLAYED_MATCH_SQL})
       ON mp.player_id = p.id
     WHERE p.active = 1
     GROUP BY p.id
     ORDER BY p.name COLLATE NOCASE`,
    [todayStr()]
  );
}

export interface MatchEventRow {
  id: number;
  player_id: number | null;
  player_name: string | null;
  stat_id: string;
  match_second: number | null;
  period: number | null;
}

// Spelare med graderad nivå + snitt från senaste utvärderingen (för förslag)
export interface PlayerLevelRow {
  id: number;
  name: string;
  jersey_number: number | null;
  position: string;
  level: string;
  eval_avg: number | null;
}

export async function getPlayersLevelInfo(): Promise<PlayerLevelRow[]> {
  return all<PlayerLevelRow>(
    `SELECT p.id, p.name, p.jersey_number, p.position, p.level,
            (SELECT AVG(es.level) FROM evaluation_scores es
               WHERE es.evaluation_id = (
                 SELECT e.id FROM evaluations e WHERE e.player_id = p.id
                 ORDER BY e.date DESC, e.id DESC LIMIT 1
               )) AS eval_avg
     FROM players p
     WHERE p.active = 1
     ORDER BY p.name COLLATE NOCASE`
  );
}

// Snitt i senaste utvärderingen för en enskild spelare (för nivåförslag)
export async function getPlayerEvalAverage(playerId: number): Promise<number | null> {
  const row = await get<{ avg: number | null }>(
    `SELECT AVG(es.level) AS avg FROM evaluation_scores es
     WHERE es.evaluation_id = (
       SELECT e.id FROM evaluations e WHERE e.player_id = ?
       ORDER BY e.date DESC, e.id DESC LIMIT 1
     )`,
    [playerId]
  );
  return row?.avg ?? null;
}

// Uttagen trupp för en match – lista med spelar-id
export async function getMatchSquad(matchId: number): Promise<number[]> {
  const rows = await all<{ player_id: number }>(
    "SELECT player_id FROM match_squad WHERE match_id = ?",
    [matchId]
  );
  return rows.map((r) => r.player_id);
}

// Utplacerade spelare på planen (startelvan) med normaliserade koordinater
export interface LineupSpot {
  player_id: number;
  x: number;
  y: number;
}

export async function getMatchLineup(matchId: number): Promise<LineupSpot[]> {
  return all<LineupSpot>(
    "SELECT player_id, x, y FROM match_lineup WHERE match_id = ?",
    [matchId]
  );
}

// Händelser i kronologisk ordning – för matchflödet på matchsidan
export async function getMatchEvents(matchId: number): Promise<MatchEventRow[]> {
  return all<MatchEventRow>(
    `SELECT e.id, e.player_id, p.name AS player_name, e.stat_id, e.match_second, e.period
     FROM match_events e LEFT JOIN players p ON p.id = e.player_id
     WHERE e.match_id = ? ORDER BY e.id ASC`,
    [matchId]
  );
}

export async function getMatchesByDate(date: string): Promise<Match[]> {
  return all<Match>("SELECT * FROM matches WHERE date = ? ORDER BY start_time ASC, id ASC", [date]);
}

export async function getAllTimeReporterHighscore(): Promise<{ name: string; events: number }[]> {
  // Gruppera skiftlägesokänsligt så samma rapportör inte splittras på casing
  return all<{ name: string; events: number }>(
    `SELECT MIN(mr.name) AS name, COUNT(me.id) AS events
     FROM match_reporters mr
     JOIN match_events me ON me.match_id = mr.match_id
       AND me.stat_id IN (SELECT value FROM json_each(mr.stats))
     GROUP BY LOWER(mr.name)
     ORDER BY events DESC`
  );
}

export async function getMatchReporters(matchId: number): Promise<Record<string, string>> {
  const rows = await all<{ name: string; stats: string }>(
    "SELECT name, stats FROM match_reporters WHERE match_id = ?",
    [matchId]
  );
  const map: Record<string, string> = {};
  for (const row of rows) {
    const stats: string[] = JSON.parse(row.stats);
    for (const stat of stats) map[stat] = row.name;
  }
  return map;
}

export async function getLatestEvaluationDates(): Promise<Record<number, string>> {
  const rows = await all<{ player_id: number; latest: string }>(
    "SELECT player_id, MAX(date) AS latest FROM evaluations GROUP BY player_id"
  );
  return Object.fromEntries(rows.map((r) => [r.player_id, r.latest]));
}

export async function countEvaluations(): Promise<number> {
  const row = await get<{ c: number }>("SELECT COUNT(*) AS c FROM evaluations");
  return Number(row?.c ?? 0);
}

export { ALL_SKILLS, CATEGORIES };

export interface PlayerSelfEval {
  id: number;
  player_id: number;
  created_at: string;
  fun_rating: number;
  progress_rating: number;
  team_rating: number;
  best_at: string;
  want_to_improve: string;
  note_to_coach: string;
}

export async function getLatestSelfEval(playerId: number, sinceIso?: string): Promise<PlayerSelfEval | null> {
  const sql = sinceIso
    ? "SELECT * FROM player_self_evals WHERE player_id = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 1"
    : "SELECT * FROM player_self_evals WHERE player_id = ? ORDER BY created_at DESC LIMIT 1";
  const args = sinceIso ? [playerId, sinceIso] : [playerId];
  return (await get<PlayerSelfEval>(sql, args)) ?? null;
}
