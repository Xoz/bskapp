import { all, get } from "./db";
import { ALL_SKILLS, CATEGORIES } from "./svff";
import { STAT_IDS } from "./stats";

export interface Player {
  id: number;
  name: string;
  jersey_number: number | null;
  notes: string;
  active: number;
}

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
  opponent: string;
  home_away: string;
  match_type: string;
  our_score: number | null;
  opponent_score: number | null;
  notes: string;
  code: string;
  source: string;
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

// Säsongsstatistik per spelare – deltagande (SvFF: alla ska spela) och insatser
export async function getSeasonStats(): Promise<SeasonStatRow[]> {
  const sums = STAT_IDS.map((c) => `COALESCE(SUM(mp.${c}), 0) AS ${c}`).join(",\n              ");
  return all<SeasonStatRow>(
    `SELECT p.id, p.name, p.jersey_number,
            COUNT(mp.match_id) AS matches_played,
            ${sums}
     FROM players p
     LEFT JOIN match_players mp ON mp.player_id = p.id
     WHERE p.active = 1
     GROUP BY p.id
     ORDER BY p.name COLLATE NOCASE`
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

// Händelser i kronologisk ordning – för matchflödet på matchsidan
export async function getMatchEvents(matchId: number): Promise<MatchEventRow[]> {
  return all<MatchEventRow>(
    `SELECT e.id, e.player_id, p.name AS player_name, e.stat_id, e.match_second, e.period
     FROM match_events e LEFT JOIN players p ON p.id = e.player_id
     WHERE e.match_id = ? ORDER BY e.id ASC`,
    [matchId]
  );
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
