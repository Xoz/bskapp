import db from "./db";
import { ALL_SKILLS, CATEGORIES } from "./svff";

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
}

export interface MatchPlayerRow {
  match_id: number;
  player_id: number;
  minutes: number;
  goals: number;
  assists: number;
}

export function getPlayers(): Player[] {
  return db
    .prepare("SELECT * FROM players WHERE active = 1 ORDER BY name COLLATE NOCASE")
    .all() as Player[];
}

export function getPlayer(id: number): Player | undefined {
  return db.prepare("SELECT * FROM players WHERE id = ?").get(id) as Player | undefined;
}

export function getEvaluations(playerId: number): Evaluation[] {
  return db
    .prepare("SELECT * FROM evaluations WHERE player_id = ? ORDER BY date DESC, id DESC")
    .all(playerId) as Evaluation[];
}

export function getScores(evaluationId: number): Record<string, number> {
  const rows = db
    .prepare("SELECT skill_id, level FROM evaluation_scores WHERE evaluation_id = ?")
    .all(evaluationId) as { skill_id: string; level: number }[];
  return Object.fromEntries(rows.map((r) => [r.skill_id, r.level]));
}

// Kategorisnitt per utvärdering, kronologiskt – för utvecklingsgrafen
export function getPlayerDevelopment(playerId: number) {
  const evals = db
    .prepare("SELECT * FROM evaluations WHERE player_id = ? ORDER BY date ASC, id ASC")
    .all(playerId) as Evaluation[];

  return evals.map((ev) => {
    const scores = getScores(ev.id);
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

export function getMatches(): Match[] {
  return db.prepare("SELECT * FROM matches ORDER BY date DESC, id DESC").all() as Match[];
}

export function getMatch(id: number): Match | undefined {
  return db.prepare("SELECT * FROM matches WHERE id = ?").get(id) as Match | undefined;
}

export function getMatchPlayers(matchId: number): MatchPlayerRow[] {
  return db
    .prepare("SELECT * FROM match_players WHERE match_id = ?")
    .all(matchId) as MatchPlayerRow[];
}

// Säsongsstatistik per spelare – för jämn speltid (SvFF) och utveckling
export function getSeasonStats() {
  const rows = db
    .prepare(
      `SELECT p.id, p.name, p.jersey_number,
              COUNT(mp.match_id) AS matches_played,
              COALESCE(SUM(mp.minutes), 0) AS total_minutes,
              COALESCE(SUM(mp.goals), 0) AS total_goals,
              COALESCE(SUM(mp.assists), 0) AS total_assists
       FROM players p
       LEFT JOIN match_players mp ON mp.player_id = p.id
       WHERE p.active = 1
       GROUP BY p.id
       ORDER BY p.name COLLATE NOCASE`
    )
    .all() as {
    id: number;
    name: string;
    jersey_number: number | null;
    matches_played: number;
    total_minutes: number;
    total_goals: number;
    total_assists: number;
  }[];
  return rows;
}

export function getLatestEvaluationDates(): Record<number, string> {
  const rows = db
    .prepare("SELECT player_id, MAX(date) AS latest FROM evaluations GROUP BY player_id")
    .all() as { player_id: number; latest: string }[];
  return Object.fromEntries(rows.map((r) => [r.player_id, r.latest]));
}

export function countEvaluations(): number {
  return (db.prepare("SELECT COUNT(*) AS c FROM evaluations").get() as { c: number }).c;
}

export { ALL_SKILLS, CATEGORIES };
