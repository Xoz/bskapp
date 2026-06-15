import crypto from "crypto";
import { all, get, run } from "./db";
import { ALL_SKILLS, CATEGORIES } from "./svff";
import { STAT_IDS } from "./stats";
import { swedishToday } from "./dates";
import { seedRating } from "./rating";

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
  form_rating: number | null;
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
  cup_phase: string; // 'group' | 'playoff'
  cup_round: string | null; // 'qf' | 'sf' | 'bronze' | 'f'
  cup_group: string; // t.ex. "Grupp A", fritext, tom = ej satt
  report_open: number; // 1 = föräldrar/hjälpare får liverapportera
}

// Ordning för slutspelsrundor – gruppspel först, sedan kvarts → semi → brons → final
export const CUP_ROUND_RANK: Record<string, number> = {
  qf: 1,
  sf: 2,
  bronze: 3,
  f: 4,
};

export const CUP_ROUND_LABELS: Record<string, string> = {
  qf: "Kvartsfinal",
  sf: "Semifinal",
  bronze: "Bronsmatch",
  f: "Final",
};

// Etikett för en slutspelsrunda – faller tillbaka på "Slutspel" om ingen runda satts.
export function cupRoundLabel(m: Match): string | null {
  if (m.cup_round && CUP_ROUND_LABELS[m.cup_round]) return CUP_ROUND_LABELS[m.cup_round];
  if (m.cup_phase === "playoff") return "Slutspel";
  return null;
}

// Visningstitel för en match. Saknas motståndaren i en slutspelsmatch visas
// rundans namn ("Final") i stället för "Hemma mot TBD".
export function matchTitle(m: Match): string {
  const noOpponent = !m.opponent || m.opponent === "TBD";
  const round = cupRoundLabel(m);
  if (noOpponent && round) return round;
  const prefix = m.home_away === "home" ? "Hemma mot" : "Borta mot";
  return `${prefix} ${m.opponent}`;
}

// Sorterar cupmatcher: gruppspel (efter datum/tid) först, därefter slutspel i
// rundordning så att finalen alltid hamnar sist – oavsett datum.
export function cupMatchCompare(a: Match, b: Match): number {
  const aPlayoff = a.cup_phase === "playoff" ? 1 : 0;
  const bPlayoff = b.cup_phase === "playoff" ? 1 : 0;
  if (aPlayoff !== bPlayoff) return aPlayoff - bPlayoff;
  if (aPlayoff === 1) {
    const ar = CUP_ROUND_RANK[a.cup_round ?? ""] ?? 9;
    const br = CUP_ROUND_RANK[b.cup_round ?? ""] ?? 9;
    if (ar !== br) return ar - br;
  }
  return (
    a.date.localeCompare(b.date) ||
    (a.start_time ?? "").localeCompare(b.start_time ?? "") ||
    a.id - b.id
  );
}

// Slutspelsronder som inte längre spelas efter en utslagning (för EN cups
// matcher). Semifinalförlust gör finalen överflödig (bronsmatch spelas ändå);
// kvartsfinalförlust slår ut laget helt.
export function cupMootRounds(cupMatches: Match[]): Set<string> {
  const lost = (round: string) =>
    cupMatches.some(
      (m) =>
        m.cup_round === round &&
        m.our_score != null &&
        m.opponent_score != null &&
        m.our_score < m.opponent_score
    );
  const moot = new Set<string>();
  if (lost("qf")) ["sf", "bronze", "f"].forEach((r) => moot.add(r));
  if (lost("sf")) moot.add("f");
  return moot;
}

// Match-id för oslagna slutspelsmatcher som laget inte längre spelar (utslaget),
// över alla cuper. Används för att dölja dem i kommande-listor.
export function mootMatchIds(allMatches: Match[]): Set<number> {
  const byCup = new Map<string, Match[]>();
  for (const m of allMatches) {
    if (!m.cup_name) continue;
    if (!byCup.has(m.cup_name)) byCup.set(m.cup_name, []);
    byCup.get(m.cup_name)!.push(m);
  }
  const ids = new Set<number>();
  for (const ms of byCup.values()) {
    const moot = cupMootRounds(ms);
    for (const m of ms) {
      const played = m.our_score != null && m.opponent_score != null;
      if (!played && m.cup_phase === "playoff" && m.cup_round && moot.has(m.cup_round)) ids.add(m.id);
    }
  }
  return ids;
}

// Matcher som ingår i samma cup/turnering (samma cup_name)
export async function getMatchesByCup(cupName: string): Promise<Match[]> {
  if (!cupName) return [];
  const rows = await all<Match>("SELECT * FROM matches WHERE cup_name = ?", [cupName]);
  return rows.sort(cupMatchCompare);
}

export interface CupScorerRow {
  cup_name: string;
  id: number;
  name: string;
  jersey_number: number | null;
  goals: number;
  assists: number;
  matches_played: number;
}

// Spelarbidrag (mål/assist) summerat per cup. Returnerar en map cup_name →
// spelare sorterade på flest mål, för "skyttar i cupen"-listan. Bara spelare
// med minst ett mål eller en assist tas med. En query för alla cuper.
export async function getCupScorers(): Promise<Map<string, CupScorerRow[]>> {
  const rows = await all<CupScorerRow>(
    `SELECT m.cup_name, p.id, p.name, p.jersey_number,
            COALESCE(SUM(mp.goals), 0) AS goals,
            COALESCE(SUM(mp.assists), 0) AS assists,
            COUNT(mp.match_id) AS matches_played
     FROM match_players mp
     JOIN matches m ON m.id = mp.match_id AND m.cup_name <> ''
     JOIN players p ON p.id = mp.player_id
     GROUP BY m.cup_name, p.id
     HAVING goals > 0 OR assists > 0
     ORDER BY m.cup_name, goals DESC, assists DESC, p.name COLLATE NOCASE`
  );
  const byCup = new Map<string, CupScorerRow[]>();
  for (const r of rows) {
    if (!byCup.has(r.cup_name)) byCup.set(r.cup_name, []);
    byCup.get(r.cup_name)!.push(r);
  }
  return byCup;
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
     ORDER BY cup_name, date DESC, start_time DESC, id DESC`,
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


export async function getMatchPlayers(matchId: number): Promise<MatchPlayerRow[]> {
  return all<MatchPlayerRow>("SELECT * FROM match_players WHERE match_id = ?", [matchId]);
}

// ---- Matchbetyg (ELO-form) ----
export interface MatchRatingRow {
  player_id: number;
  overall: string; // "mot förväntan"-stegets nyckel
  scores: Record<string, number>; // ev. områdesutfall (avancerat läge)
  suggested: string;
  delta: number;
}

export async function getMatchRatings(matchId: number): Promise<MatchRatingRow[]> {
  const rows = await all<{ player_id: number; overall: string; scores: string; suggested: string; delta: number }>(
    "SELECT player_id, overall, scores, suggested, delta FROM match_ratings WHERE match_id = ?",
    [matchId]
  );
  return rows.map((r) => {
    let scores: Record<string, number> = {};
    try {
      scores = r.scores ? (JSON.parse(r.scores) as Record<string, number>) : {};
    } catch {
      scores = {};
    }
    return { player_id: r.player_id, overall: r.overall, scores, suggested: r.suggested, delta: r.delta };
  });
}

// Form-trend för en spelare: löpande form-tal efter varje betygsatt match,
// rekonstruerat från seed (spelarens nivå) + ackumulerade deltan i datumordning.
export interface FormTrendPoint {
  match_id: number;
  date: string;
  opponent: string;
  outcome: string;
  delta: number;
  rating: number;
}

export async function getPlayerFormTrend(playerId: number): Promise<FormTrendPoint[]> {
  const rows = await all<{ match_id: number; date: string; opponent: string; overall: string; delta: number }>(
    `SELECT r.match_id, m.date, m.opponent, r.overall, r.delta
     FROM match_ratings r JOIN matches m ON m.id = r.match_id
     WHERE r.player_id = ?
     ORDER BY m.date ASC, m.id ASC`,
    [playerId]
  );
  if (rows.length === 0) return [];
  const p = await get<{ level: string }>("SELECT level FROM players WHERE id = ?", [playerId]);
  let rating = seedRating(p?.level);
  return rows.map((r) => {
    rating += r.delta;
    return { match_id: r.match_id, date: r.date, opponent: r.opponent, outcome: r.overall, delta: r.delta, rating };
  });
}

// Målgörare/assist i en enskild match – för "senaste matchen"-kortet på översikten.
export interface MatchScorerRow {
  player_id: number;
  name: string;
  jersey_number: number | null;
  goals: number;
  assists: number;
}

export async function getMatchScorers(matchId: number): Promise<MatchScorerRow[]> {
  return all<MatchScorerRow>(
    `SELECT p.id AS player_id, p.name, p.jersey_number, mp.goals, mp.assists
     FROM match_players mp JOIN players p ON p.id = mp.player_id
     WHERE mp.match_id = ? AND (mp.goals > 0 OR mp.assists > 0)
     ORDER BY mp.goals DESC, mp.assists DESC, p.name COLLATE NOCASE`,
    [matchId]
  );
}

// Form-översikt: aktiva spelare som har ett form-tal, med senaste matchens delta
// (= riktningen formen rörde sig sist) och antal betygsatta matcher. Sorterad på
// form fallande så översikten kan visa de hetaste högst upp.
export interface FormOverviewRow {
  id: number;
  name: string;
  jersey_number: number | null;
  form_rating: number;
  last_delta: number | null;
  rated_count: number;
}

export async function getFormOverview(): Promise<FormOverviewRow[]> {
  return all<FormOverviewRow>(
    `SELECT p.id, p.name, p.jersey_number, p.form_rating,
            (SELECT r.delta FROM match_ratings r JOIN matches m ON m.id = r.match_id
             WHERE r.player_id = p.id ORDER BY m.date DESC, m.id DESC LIMIT 1) AS last_delta,
            (SELECT COUNT(*) FROM match_ratings r WHERE r.player_id = p.id) AS rated_count
     FROM players p
     WHERE p.active = 1 AND p.form_rating IS NOT NULL
     ORDER BY p.form_rating DESC, p.name COLLATE NOCASE`
  );
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
  return swedishToday();
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

export interface TeamMatchStatRow {
  id: number;
  date: string;
  opponent: string;
  home_away: string;
  our_score: number | null;
  opponent_score: number | null;
  finished: number;
  level: string;
  cup_name: string;
  players_logged: number;
  goals: number;
  assists: number;
  shots: number;
  shots_on_target: number;
  passes_completed: number;
  interceptions: number;
  saves: number;
}

// Lagets statistik per spelad match – resultat + summerade insatser. Används för
// KPI-kort och match-för-match-vyn på statistiksidan. Bara spelade matcher.
export async function getTeamMatchStats(): Promise<TeamMatchStatRow[]> {
  const sums = STAT_IDS.map((c) => `COALESCE(SUM(mp.${c}), 0) AS ${c}`).join(",\n            ");
  return all<TeamMatchStatRow>(
    `SELECT m.id, m.date, m.opponent, m.home_away, m.our_score, m.opponent_score,
            m.finished, m.level, m.cup_name,
            COUNT(mp.player_id) AS players_logged,
            ${sums}
     FROM matches m
     LEFT JOIN match_players mp ON mp.match_id = m.id
     WHERE ${PLAYED_MATCH_SQL}
     GROUP BY m.id
     ORDER BY m.date DESC, m.id DESC`,
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

export async function getMatchesWithSquad(matchIds: number[]): Promise<Set<number>> {
  if (matchIds.length === 0) return new Set();
  const placeholders = matchIds.map(() => "?").join(",");
  const rows = await all<{ match_id: number }>(
    `SELECT DISTINCT match_id FROM match_squad WHERE match_id IN (${placeholders})`,
    matchIds
  );
  return new Set(rows.map((r) => r.match_id));
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
  // Kombinerar två källor för att täcka in hela historiken:
  // 1. Händelser med reporter-kolonnen satt (sedan per-rapportör-loggning lades till)
  // 2. Äldre händelser som saknar reporter – räknas via match_reporters-tabellen
  return all<{ name: string; events: number }>(
    `SELECT MIN(name) AS name, SUM(events) AS events FROM (
       SELECT MIN(reporter) AS name, COUNT(*) AS events
       FROM match_events
       WHERE reporter IS NOT NULL AND reporter != ''
         AND stat_id != 'opponent_goal'
       GROUP BY LOWER(reporter)
       UNION ALL
       SELECT MIN(mr.name) AS name, COUNT(me.id) AS events
       FROM match_reporters mr
       JOIN match_events me ON me.match_id = mr.match_id
         AND me.reporter IS NULL
         AND me.stat_id IN (SELECT value FROM json_each(mr.stats))
       GROUP BY LOWER(mr.name)
     )
     GROUP BY LOWER(name)
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

export interface PlayerInterview {
  id: number;
  player_name: string;
  position: string;
  interview_type: string;
  summary: string;
  scores: string;
  messages: string;
  created_at: string;
}

export async function saveIntervju(
  playerName: string,
  position: string,
  summary: string,
  messages: string,
  interviewType = "spelarsamtal",
  scores = "{}"
): Promise<void> {
  await run(
    `INSERT INTO player_interviews (player_name, position, summary, messages, interview_type, scores) VALUES (?, ?, ?, ?, ?, ?)`,
    [playerName, position, summary, messages, interviewType, scores]
  );
}

export async function getIntervjuer(): Promise<PlayerInterview[]> {
  return all<PlayerInterview>(
    `SELECT id, player_name, position, interview_type, summary, scores, messages, created_at FROM player_interviews ORDER BY created_at DESC`
  );
}

// Kategorisnitt från tränarens senaste utvärdering – för jämförelse med kvartalsutvärdering
export async function getCoachCategoryScores(
  playerId: number
): Promise<Record<string, number> | null> {
  const evals = await getEvaluations(playerId);
  if (evals.length === 0) return null;
  const scores = await getScores(evals[0].id);
  if (Object.keys(scores).length === 0) return null;

  // Gruppera skill_id → category_id enligt SvFF-strukturen
  const categorySkills: Record<string, string[]> = {
    anfall_boll: ["driva", "utmana", "passa", "mottagning", "avslut"],
    anfall_utan_boll: ["spelbarhet", "speldjup_bredd"],
    forsvar: ["press", "positionering", "omstallning"],
    fysik: ["motorik", "snabbhet"],
    psykosocialt: ["traningsvilja", "lagkansla", "mod", "gladje"],
  };

  const result: Record<string, number> = {};
  for (const [cat, skillIds] of Object.entries(categorySkills)) {
    const vals = skillIds.map((s) => scores[s]).filter((v) => v != null);
    if (vals.length > 0) result[cat] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  }
  return Object.keys(result).length > 0 ? result : null;
}

// Hitta spelare på förnamn eller fullständigt namn (case-insensitiv ASCII)
export async function findPlayerForIntervju(name: string): Promise<Player | undefined> {
  const clean = name.trim();
  return (
    (await get<Player>(
      `SELECT * FROM players WHERE active = 1 AND (name = ? OR name LIKE ? || ' %') LIMIT 1`,
      [clean, clean]
    )) ??
    (await get<Player>(
      `SELECT * FROM players WHERE active = 1 AND LOWER(name) = LOWER(?) OR (active = 1 AND LOWER(name) LIKE LOWER(?) || ' %') LIMIT 1`,
      [clean, clean]
    ))
  );
}
