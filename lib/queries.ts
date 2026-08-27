import crypto from "crypto";
import { all, get, run } from "./db";
import { ALL_SKILLS, CATEGORIES } from "./svff";
import { STAT_IDS } from "./stats";
import { swedishToday } from "./dates";
import { getCurrentUser } from "./auth";
import { CATEGORIES as SKILL_CATEGORIES, categoryProgress, type StatusMap } from "./skillTrappan";

export interface Player {
  id: number;
  name: string;
  jersey_number: number | null;
  notes: string;
  active: number;
  position: string;
  preferred_position_primary: string;
  preferred_position_secondary: string;
  preferred_level_primary: string;
  preferred_level_secondary: string;
  level_assessed_at: string | null;
  level_assessed_by: string;
  selection_eligible: number;
  share_token: string | null;
  share_expires: number | null;
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
  clock_running: number; // 1 = matchklockan rullar just nu (live)
  level: string;
  cup_name: string;
  formation: string;
  cup_phase: string; // 'group' | 'playoff'
  cup_round: string | null; // 'qf' | 'sf' | 'bronze' | 'f'
  cup_group: string; // t.ex. "Grupp A", fritext, tom = ej satt
  report_open: number; // 1 = föräldrar/hjälpare får liverapportera
  report_token: string;
  location: string;
  group_id: number | null;
}

async function restrictedUserId(): Promise<number | null> {
  const user = await getCurrentUser();
  if (!user || user.roles.includes("admin") || user.groupIds.length === 0) return null;
  return user.id;
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
    // Samma cupnamn kan innehålla flera av lagets grupper/trupper. Ett lag som
    // åker ur i en grupp får inte göra en annan grupps slutspelsmatcher moot.
    const cupKey = JSON.stringify([m.cup_name, m.cup_group ?? ""]);
    if (!byCup.has(cupKey)) byCup.set(cupKey, []);
    byCup.get(cupKey)!.push(m);
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

// Matcher som ingår i samma cup/turnering (cup_name + cup_group är sammansatt nyckel)
export async function getMatchesByCup(cupName: string, cupGroup = ""): Promise<Match[]> {
  if (!cupName) return [];
  const userId = await restrictedUserId();
  const rows = await all<Match>(
    `SELECT m.* FROM matches m WHERE m.cup_name = ? AND m.cup_group = ?
     ${userId ? "AND EXISTS (SELECT 1 FROM groups scope_g JOIN user_group_access uga ON uga.user_id = ? AND (uga.group_id = scope_g.id OR uga.group_id = scope_g.parent_id) WHERE scope_g.id = m.group_id)" : ""}`,
    userId ? [cupName, cupGroup, userId] : [cupName, cupGroup]
  );
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
  const userId = await restrictedUserId();
  const rows = await all<CupScorerRow>(
    `SELECT m.cup_name, p.id, p.name, p.jersey_number,
            COALESCE(SUM(mp.goals), 0) AS goals,
            COALESCE(SUM(mp.assists), 0) AS assists,
            COUNT(mp.match_id) AS matches_played
     FROM match_players mp
     JOIN matches m ON m.id = mp.match_id AND m.cup_name <> ''
     JOIN players p ON p.id = mp.player_id
     ${userId ? "WHERE EXISTS (SELECT 1 FROM groups scope_g JOIN user_group_access uga ON uga.user_id = ? AND (uga.group_id = scope_g.id OR uga.group_id = scope_g.parent_id) WHERE scope_g.id = m.group_id)" : ""}
     GROUP BY m.cup_name, p.id
     HAVING COALESCE(SUM(mp.goals), 0) > 0 OR COALESCE(SUM(mp.assists), 0) > 0
     ORDER BY m.cup_name, goals DESC, assists DESC, lower(p.name)`,
    userId ? [userId] : []
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
  const userId = await restrictedUserId();
  return all<Player>(
    `SELECT p.* FROM players p WHERE p.active = 1
     ${userId ? "AND EXISTS (SELECT 1 FROM player_group_memberships pgm JOIN groups scope_g ON scope_g.id = pgm.group_id JOIN user_group_access uga ON uga.user_id = ? AND (uga.group_id = scope_g.id OR uga.group_id = scope_g.parent_id) WHERE pgm.player_id = p.id)" : ""}
     ORDER BY lower(p.name)`,
    userId ? [userId] : []
  );
}

export async function getPlayer(id: number): Promise<Player | undefined> {
  const userId = await restrictedUserId();
  return get<Player>(
    `SELECT p.* FROM players p WHERE p.id = ?
     ${userId ? "AND EXISTS (SELECT 1 FROM player_group_memberships pgm JOIN groups scope_g ON scope_g.id = pgm.group_id JOIN user_group_access uga ON uga.user_id = ? AND (uga.group_id = scope_g.id OR uga.group_id = scope_g.parent_id) WHERE pgm.player_id = p.id)" : ""}`,
    userId ? [id, userId] : [id]
  );
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
  await run("UPDATE players SET share_token = NULL, share_expires = NULL WHERE id = ?", [playerId]);
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
  const userId = await restrictedUserId();
  return all<Match>(
    `SELECT m.* FROM matches m
     ${userId ? "WHERE EXISTS (SELECT 1 FROM groups scope_g JOIN user_group_access uga ON uga.user_id = ? AND (uga.group_id = scope_g.id OR uga.group_id = scope_g.parent_id) WHERE scope_g.id = m.group_id)" : ""}
     ORDER BY m.date DESC, m.id DESC`,
    userId ? [userId] : []
  );
}

export async function getMatch(id: number): Promise<Match | undefined> {
  const userId = await restrictedUserId();
  return get<Match>(
    `SELECT m.* FROM matches m WHERE m.id = ?
     ${userId ? "AND EXISTS (SELECT 1 FROM groups scope_g JOIN user_group_access uga ON uga.user_id = ? AND (uga.group_id = scope_g.id OR uga.group_id = scope_g.parent_id) WHERE scope_g.id = m.group_id)" : ""}`,
    userId ? [id, userId] : [id]
  );
}


export async function getMatchPlayers(matchId: number): Promise<MatchPlayerRow[]> {
  return all<MatchPlayerRow>("SELECT * FROM match_players WHERE match_id = ?", [matchId]);
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
     ORDER BY mp.goals DESC, mp.assists DESC, lower(p.name)`,
    [matchId]
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
  const userId = await restrictedUserId();
  return all<PlayerMatchRow>(
    `SELECT m.id AS match_id, m.date, m.opponent, m.home_away,
            m.our_score, m.opponent_score,
            mp.goals, mp.assists, mp.shots, mp.shots_on_target,
            mp.passes_completed, mp.interceptions, mp.saves
     FROM match_players mp
     JOIN matches m ON m.id = mp.match_id
     WHERE mp.player_id = ? AND ${PLAYED_MATCH_SQL}
       ${userId ? "AND EXISTS (SELECT 1 FROM groups scope_g JOIN user_group_access uga ON uga.user_id = ? AND (uga.group_id = scope_g.id OR uga.group_id = scope_g.parent_id) WHERE scope_g.id = m.group_id)" : ""}
     ORDER BY m.date DESC, m.id DESC`,
    userId ? [playerId, todayStr(), userId] : [playerId, todayStr()]
  );
}

// Säsongsstatistik per spelare – deltagande (SvFF: alla ska spela) och insatser.
// Bara spelade matcher räknas, så siffran stämmer med spelarprofilen.
export async function getSeasonStats(): Promise<SeasonStatRow[]> {
  const sums = STAT_IDS.map((c) => `COALESCE(SUM(mp.${c}), 0) AS ${c}`).join(",\n              ");
  const userId = await restrictedUserId();
  return all<SeasonStatRow>(
    `SELECT p.id, p.name, p.jersey_number,
            COUNT(mp.match_id) AS matches_played,
            ${sums}
     FROM players p
     LEFT JOIN (match_players mp JOIN matches m ON m.id = mp.match_id AND ${PLAYED_MATCH_SQL})
       ON mp.player_id = p.id
     WHERE p.active = 1
       ${userId ? "AND EXISTS (SELECT 1 FROM player_group_memberships pgm JOIN groups scope_g ON scope_g.id = pgm.group_id JOIN user_group_access uga ON uga.user_id = ? AND (uga.group_id = scope_g.id OR uga.group_id = scope_g.parent_id) WHERE pgm.player_id = p.id)" : ""}
     GROUP BY p.id
     ORDER BY lower(p.name)`,
    userId ? [todayStr(), userId] : [todayStr()]
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
  const userId = await restrictedUserId();
  return all<TeamMatchStatRow>(
    `SELECT m.id, m.date, m.opponent, m.home_away, m.our_score, m.opponent_score,
            m.finished, m.level, m.cup_name,
            COUNT(mp.player_id) AS players_logged,
            ${sums}
     FROM matches m
     LEFT JOIN match_players mp ON mp.match_id = m.id
     WHERE ${PLAYED_MATCH_SQL}
       ${userId ? "AND EXISTS (SELECT 1 FROM groups scope_g JOIN user_group_access uga ON uga.user_id = ? AND (uga.group_id = scope_g.id OR uga.group_id = scope_g.parent_id) WHERE scope_g.id = m.group_id)" : ""}
     GROUP BY m.id
     ORDER BY m.date DESC, m.id DESC`,
    userId ? [todayStr(), userId] : [todayStr()]
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
  const userId = await restrictedUserId();
  return all<PlayerLevelRow>(
    `SELECT p.id, p.name, p.jersey_number, p.position,
            CASE p.preferred_level_primary WHEN '2' THEN 'svar' WHEN '3' THEN 'medel' WHEN '4' THEN 'latt' ELSE '' END AS level,
            (SELECT AVG(es.level) FROM evaluation_scores es
               WHERE es.evaluation_id = (
                 SELECT e.id FROM evaluations e WHERE e.player_id = p.id
                 ORDER BY e.date DESC, e.id DESC LIMIT 1
               )) AS eval_avg
     FROM players p
     WHERE p.active = 1
       ${userId ? "AND EXISTS (SELECT 1 FROM player_group_memberships pgm JOIN groups scope_g ON scope_g.id = pgm.group_id JOIN user_group_access uga ON uga.user_id = ? AND (uga.group_id = scope_g.id OR uga.group_id = scope_g.parent_id) WHERE pgm.player_id = p.id)" : ""}
     ORDER BY lower(p.name)`,
    userId ? [userId] : []
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
    "SELECT player_id FROM match_roster WHERE match_id = ? AND selection_status = 'selected'",
    [matchId]
  );
  return rows.map((r) => r.player_id);
}

// Spelar-id som ingår i en grupp. För en cups matchgrupp = den uttagna truppen,
// som används som default-trupp per match i laguttagningen.
export async function getGroupMemberIds(groupId: number | null): Promise<number[]> {
  if (!groupId) return [];
  const rows = await all<{ player_id: number }>(
    "SELECT player_id FROM player_group_memberships WHERE group_id = ?",
    [groupId]
  );
  return rows.map((r) => r.player_id);
}

export async function getMatchesWithSquad(matchIds: number[]): Promise<Set<number>> {
  if (matchIds.length === 0) return new Set();
  const placeholders = matchIds.map(() => "?").join(",");
  const rows = await all<{ match_id: number }>(
    `SELECT DISTINCT match_id FROM match_roster WHERE match_id IN (${placeholders}) AND selection_status = 'selected'`,
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
    "SELECT player_id, lineup_x AS x, lineup_y AS y FROM match_roster WHERE match_id = ? AND lineup_x IS NOT NULL",
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
  const userId = await restrictedUserId();
  return all<Match>(
    `SELECT m.* FROM matches m WHERE m.date = ?
     ${userId ? "AND EXISTS (SELECT 1 FROM groups scope_g JOIN user_group_access uga ON uga.user_id = ? AND (uga.group_id = scope_g.id OR uga.group_id = scope_g.parent_id) WHERE scope_g.id = m.group_id)" : ""}
     ORDER BY m.start_time ASC, m.id ASC`,
    userId ? [date, userId] : [date]
  );
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
  const userId = await restrictedUserId();
  const rows = await all<{ player_id: number; latest: string }>(
    `SELECT e.player_id, MAX(e.date) AS latest FROM evaluations e
     ${userId ? "WHERE EXISTS (SELECT 1 FROM player_group_memberships pgm JOIN groups scope_g ON scope_g.id = pgm.group_id JOIN user_group_access uga ON uga.user_id = ? AND (uga.group_id = scope_g.id OR uga.group_id = scope_g.parent_id) WHERE pgm.player_id = e.player_id)" : ""}
     GROUP BY e.player_id`,
    userId ? [userId] : []
  );
  return Object.fromEntries(rows.map((r) => [r.player_id, r.latest]));
}

export async function countEvaluations(): Promise<number> {
  const row = await get<{ c: number }>("SELECT COUNT(*) AS c FROM evaluations");
  return Number(row?.c ?? 0);
}

export interface AttendanceImportSummary {
  id: number;
  file_name: string;
  period_label: string;
  team_name: string;
  exported_at: string | null;
  created_at: string;
  player_count: number;
  activity_count: number;
  present_count: number;
  total_rows: number;
}

export async function getLatestAttendanceImportSummary(): Promise<AttendanceImportSummary | null> {
  const row = await get<AttendanceImportSummary>(
    `SELECT ai.id, ai.file_name, ai.period_label, ai.team_name, ai.exported_at, ai.created_at,
            COUNT(DISTINCT ae.player_name) AS player_count,
            COUNT(DISTINCT ae.source_column) AS activity_count,
            COALESCE(SUM(ae.present), 0) AS present_count,
            COUNT(*) AS total_rows
     FROM attendance_imports ai
     LEFT JOIN attendance_events ae ON ae.import_id = ai.id
     WHERE ai.id = (SELECT id FROM attendance_imports ORDER BY id DESC LIMIT 1)
     GROUP BY ai.id`,
    []
  );
  return row ?? null;
}

export interface PlayerAttendanceOverview {
  total_activities: number;
  attended_activities: number;
  attendance_rate: number | null;
}

export interface PlayerAttendanceCategoryRow {
  category: string;
  total_activities: number;
  attended_activities: number;
  attendance_rate: number | null;
}

export interface PlayerAttendanceTrendRow {
  month: string;
  total_activities: number;
  attended_activities: number;
  attendance_rate: number | null;
  training_total: number;
  training_attended: number;
  training_rate: number | null;
}

export async function getPlayerAttendanceOverview(playerId: number): Promise<PlayerAttendanceOverview | null> {
  const row = await get<PlayerAttendanceOverview>(
    `SELECT COUNT(*) AS total_activities,
            COUNT(*) FILTER (WHERE dap.attendance_status = 'present') AS attended_activities,
            ROUND(100.0 * COUNT(*) FILTER (WHERE dap.attendance_status = 'present') / NULLIF(COUNT(*), 0), 1) AS attendance_rate
     FROM development_activity_participation dap
     JOIN development_activities da ON da.id = dap.activity_id
     WHERE dap.source = 'svenskalag_attendance' AND dap.player_id = ?`,
    [playerId]
  );
  return row && row.total_activities > 0 ? row : null;
}

export async function getPlayerAttendanceByCategory(playerId: number): Promise<PlayerAttendanceCategoryRow[]> {
  return all<PlayerAttendanceCategoryRow>(
    `SELECT da.activity_type AS category,
            COUNT(*) AS total_activities,
            COUNT(*) FILTER (WHERE dap.attendance_status = 'present') AS attended_activities,
            ROUND(100.0 * COUNT(*) FILTER (WHERE dap.attendance_status = 'present') / NULLIF(COUNT(*), 0), 1) AS attendance_rate
     FROM development_activity_participation dap
     JOIN development_activities da ON da.id = dap.activity_id
     WHERE dap.source = 'svenskalag_attendance' AND dap.player_id = ?
     GROUP BY da.activity_type
     ORDER BY total_activities DESC, category ASC`,
    [playerId]
  );
}

export async function getPlayerAttendanceTrend(playerId: number): Promise<PlayerAttendanceTrendRow[]> {
  return all<PlayerAttendanceTrendRow>(
    `SELECT substr(da.activity_date, 1, 7) AS month,
            COUNT(*) AS total_activities,
            COUNT(*) FILTER (WHERE dap.attendance_status = 'present') AS attended_activities,
            ROUND(100.0 * COUNT(*) FILTER (WHERE dap.attendance_status = 'present') / NULLIF(COUNT(*), 0), 1) AS attendance_rate,
            COUNT(*) FILTER (WHERE da.activity_type = 'training') AS training_total,
            COUNT(*) FILTER (WHERE da.activity_type = 'training' AND dap.attendance_status = 'present') AS training_attended,
            ROUND(
              100.0 * COUNT(*) FILTER (WHERE da.activity_type = 'training' AND dap.attendance_status = 'present')
              / NULLIF(COUNT(*) FILTER (WHERE da.activity_type = 'training'), 0),
              1
            ) AS training_rate
     FROM development_activity_participation dap
     JOIN development_activities da ON da.id = dap.activity_id
     WHERE dap.source = 'svenskalag_attendance' AND dap.player_id = ?
       AND da.activity_date IS NOT NULL
     GROUP BY substr(da.activity_date, 1, 7)
     ORDER BY month ASC`,
    [playerId]
  );
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

// ---------- Utvecklingsträdet (skillTrappan) ----------

export async function getPlayerSkillStatuses(playerId: number): Promise<StatusMap> {
  const rows = await all<{ skill_id: string; status: string }>(
    "SELECT skill_id, status FROM player_skill_status WHERE player_id = ?",
    [playerId]
  );
  return Object.fromEntries(rows.map((r) => [r.skill_id, r.status])) as StatusMap;
}

export async function getPlayerSkillNote(playerId: number): Promise<string> {
  const row = await get<{ note: string }>("SELECT note FROM player_skill_notes WHERE player_id = ?", [playerId]);
  return row?.note ?? "";
}

export interface DevelopmentCheckpoint {
  id: string;
  player_id: number;
  date: string;
  coach_name: string;
  strengths: string;
  focus_note: string;
  wellbeing_note: string;
  changed_count: number;
  created_at: string;
}

export interface DevelopmentCheckpointSkill {
  checkpoint_id: string;
  skill_id: string;
  status: StatusMap[string];
  previous_status: StatusMap[string];
  is_focus: number;
}

export async function getDevelopmentCheckpoints(playerId: number): Promise<DevelopmentCheckpoint[]> {
  return all<DevelopmentCheckpoint>(
    `SELECT dc.*,
       COUNT(dcs.skill_id) FILTER (WHERE dcs.status <> dcs.previous_status)::int AS changed_count
     FROM development_checkpoints dc
     LEFT JOIN development_checkpoint_skills dcs ON dcs.checkpoint_id = dc.id
     WHERE dc.player_id = ?
     GROUP BY dc.id
     ORDER BY dc.date DESC, dc.created_at DESC`,
    [playerId]
  );
}

export async function getDevelopmentCheckpointSkills(
  checkpointId: string
): Promise<DevelopmentCheckpointSkill[]> {
  return all<DevelopmentCheckpointSkill>(
    `SELECT checkpoint_id, skill_id, status, previous_status, is_focus
     FROM development_checkpoint_skills
     WHERE checkpoint_id = ?
     ORDER BY skill_id`,
    [checkpointId]
  );
}

export async function getLatestDevelopmentCheckpoint(
  playerId: number
): Promise<(DevelopmentCheckpoint & { skills: DevelopmentCheckpointSkill[] }) | null> {
  const checkpoints = await getDevelopmentCheckpoints(playerId);
  const latest = checkpoints[0];
  if (!latest) return null;
  return { ...latest, skills: await getDevelopmentCheckpointSkills(latest.id) };
}

export interface PlayerConversation {
  id: string;
  player_id: number;
  conversation_date: string;
  coach_name: string;
  coach_summary: string;
  player_perspective: string;
  agreed_actions: string;
  follow_up_on: string | null;
  development_checkpoint_id: string | null;
  created_at: string;
}

export async function getPlayerConversations(playerId: number): Promise<PlayerConversation[]> {
  return all<PlayerConversation>(
    `SELECT id, player_id, conversation_date, coach_name, coach_summary,
            player_perspective, agreed_actions, follow_up_on,
            development_checkpoint_id, created_at
     FROM player_conversations
     WHERE player_id = ?
     ORDER BY conversation_date DESC, created_at DESC`,
    [playerId]
  );
}

export interface TeamSkillOverviewRow {
  category: string;
  avgPercent: number;
  avgLevel: number;
}

// Snitt per kategori över alla aktiva spelare – till lagets startsida för utvecklingsträdet.
export async function getTeamSkillOverview(): Promise<TeamSkillOverviewRow[]> {
  const userId = await restrictedUserId();
  const players = await all<{ id: number }>(
    `SELECT p.id FROM players p WHERE p.active = 1
     ${userId ? "AND EXISTS (SELECT 1 FROM player_group_memberships pgm JOIN groups scope_g ON scope_g.id = pgm.group_id JOIN user_group_access uga ON uga.user_id = ? AND (uga.group_id = scope_g.id OR uga.group_id = scope_g.parent_id) WHERE pgm.player_id = p.id)" : ""}`,
    userId ? [userId] : []
  );
  if (players.length === 0) return SKILL_CATEGORIES.map((c) => ({ category: c.id, avgPercent: 0, avgLevel: 1 }));

  const rows = await all<{ player_id: number; skill_id: string; status: string }>(
    `SELECT player_id, skill_id, status FROM player_skill_status WHERE player_id IN (${players.map(() => "?").join(",")})`,
    players.map((p) => p.id)
  );
  const byPlayer = new Map<number, StatusMap>(players.map((p) => [p.id, {}]));
  for (const r of rows) byPlayer.get(r.player_id)![r.skill_id] = r.status as StatusMap[string];

  return SKILL_CATEGORIES.map((cat) => {
    const progresses = players.map((p) => categoryProgress(cat.id, byPlayer.get(p.id)!));
    return {
      category: cat.id,
      avgPercent: Math.round(progresses.reduce((sum, p) => sum + p.percent, 0) / progresses.length),
      avgLevel: Math.round(progresses.reduce((sum, p) => sum + p.currentLevel, 0) / progresses.length),
    };
  });
}
