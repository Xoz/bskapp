import postgres from "postgres";
import type { Diagram } from "@/domain/diagram";
import type { CoachMatch, DevelopmentGoal, Exercise, Player, SeasonPeriod, TrainingSession } from "@/domain/model";

const sql = postgres(process.env.DATABASE_URL ?? "postgres://coach:coach@localhost:5434/coach", { max: 5 });

async function pilotTeam() {
  const requestedId = process.env.PILOT_TEAM_ID;
  const rows = requestedId
    ? await sql`SELECT id, organization_id FROM teams WHERE id = ${requestedId} LIMIT 1`
    : await sql`SELECT id, organization_id FROM teams ORDER BY created_at LIMIT 1`;
  if (!rows[0]) throw new Error("Pilotlaget saknas. Kör npm run db:seed.");
  return { id: String(rows[0].id), organizationId: String(rows[0].organization_id) };
}

async function audit(action: string, entityType: string, entityId?: string, metadata: Record<string, unknown> = {}) {
  const team = await pilotTeam();
  await sql`INSERT INTO activity_logs (organization_id,action,entity_type,entity_id,metadata) VALUES (${team.organizationId},${action},${entityType},${entityId ?? null},${sql.json(metadata as postgres.JSONValue)})`;
}

export async function listPlayers(): Promise<Player[]> {
  const team = await pilotTeam();
  const rows = await sql`SELECT id, team_id, name, birth_year, shirt_number, positions, status FROM players WHERE team_id = ${team.id} ORDER BY lower(name)`;
  return rows.map(row => ({ id: String(row.id), teamId: String(row.team_id), name: String(row.name), birthYear: Number(row.birth_year), number: row.shirt_number == null ? undefined : Number(row.shirt_number), positions: row.positions as string[], status: row.status === "paused" ? "paused" : "active" }));
}

export async function savePlayer(input: { id?: string; name: string; birthYear: number; number?: number; positions: string[] }) {
  const team = await pilotTeam();
  if (input.id) {
    await sql`UPDATE players SET name=${input.name}, birth_year=${input.birthYear}, shirt_number=${input.number ?? null}, positions=${input.positions} WHERE id=${input.id} AND team_id=${team.id}`;
  } else {
    await sql`INSERT INTO players (team_id,name,birth_year,shirt_number,positions) VALUES (${team.id},${input.name},${input.birthYear},${input.number ?? null},${input.positions})`;
  }
}

export async function deletePlayer(id: string) {
  const team = await pilotTeam();
  await sql`DELETE FROM players WHERE id=${id} AND team_id=${team.id}`;
}

export async function listExercises(): Promise<Exercise[]> {
  const team = await pilotTeam();
  const rows = await sql`SELECT id,name,summary,duration_minutes,min_players,max_players FROM exercises WHERE organization_id=${team.organizationId} ORDER BY lower(name)`;
  return rows.map(row => ({ id: String(row.id), name: String(row.name), summary: String(row.summary), durationMinutes: Number(row.duration_minutes), players: [Number(row.min_players), Number(row.max_players)], gameFormats: ["7v7"], difficulty: 1, skillIds: [], equipment: [] }));
}

export async function saveExercise(input: { id?: string; name: string; summary: string; durationMinutes: number; minPlayers: number; maxPlayers: number }) {
  const team = await pilotTeam();
  if (input.id) {
    await sql`UPDATE exercises SET name=${input.name}, summary=${input.summary}, duration_minutes=${input.durationMinutes}, min_players=${input.minPlayers}, max_players=${input.maxPlayers}, updated_at=now() WHERE id=${input.id} AND organization_id=${team.organizationId}`;
  } else {
    await sql`INSERT INTO exercises (organization_id,name,summary,min_players,max_players,duration_minutes) VALUES (${team.organizationId},${input.name},${input.summary},${input.minPlayers},${input.maxPlayers},${input.durationMinutes})`;
  }
}

export async function deleteExercise(id: string) {
  const team = await pilotTeam();
  await sql`DELETE FROM exercises WHERE id=${id} AND organization_id=${team.organizationId}`;
}

export async function getExercise(id: string): Promise<{ id: string; name: string } | null> {
  const team = await pilotTeam();
  const rows = await sql`SELECT id, name FROM exercises WHERE id=${id} AND organization_id=${team.organizationId}`;
  return rows[0] ? { id: String(rows[0].id), name: String(rows[0].name) } : null;
}

export async function getDiagram(exerciseId: string): Promise<Diagram | null> {
  const team = await pilotTeam();
  const rows = await sql`SELECT objects, actions, width_ratio FROM exercise_diagrams d JOIN exercises e ON e.id=d.exercise_id WHERE d.exercise_id=${exerciseId} AND e.organization_id=${team.organizationId} ORDER BY d.version DESC LIMIT 1`;
  if (!rows[0]) return null;
  const r = rows[0];
  const widthRatio = Number(r.width_ratio);
  const objects = (r.objects ?? []) as Diagram["objects"];
  const arrows = (r.actions ?? []) as Diagram["arrows"];
  return { widthRatio, objects, arrows };
}

// ponytail: SELECT-then-upsert utan unique-constraint; sällsynt race för pilot-MVP,
// lägg UNIQUE(exercise_id) om flera tränare skriver samtidigt
export async function saveDiagram(exerciseId: string, diagram: Diagram) {
  const team = await pilotTeam();
  const guard = await sql`SELECT id FROM exercises WHERE id=${exerciseId} AND organization_id=${team.organizationId}`;
  if (!guard[0]) throw new Error("Övningen finns inte i pilotorganisationen.");
  const existing = await sql`SELECT id FROM exercise_diagrams WHERE exercise_id=${exerciseId} ORDER BY version DESC LIMIT 1`;
  const obj = sql.json(diagram.objects as unknown as postgres.JSONValue);
  const act = sql.json(diagram.arrows as unknown as postgres.JSONValue);
  if (existing[0]) {
    await sql`UPDATE exercise_diagrams SET objects=${obj}, actions=${act}, width_ratio=${diagram.widthRatio} WHERE id=${existing[0].id}`;
  } else {
    await sql`INSERT INTO exercise_diagrams (exercise_id, version, width_ratio, objects, actions) VALUES (${exerciseId}, 1, ${diagram.widthRatio}, ${obj}, ${act})`;
  }
}

export async function listSessions(): Promise<TrainingSession[]> {
  const team = await pilotTeam();
  const rows = await sql`SELECT id,team_id,title,starts_at,theme,planned_minutes,status FROM training_sessions WHERE team_id=${team.id} ORDER BY starts_at`;
  const blocks = await sql`SELECT id,session_id,exercise_id,title,minutes,coaching_points FROM training_session_blocks WHERE session_id IN (SELECT id FROM training_sessions WHERE team_id=${team.id}) ORDER BY sort_order`;
  return rows.map(row => ({
    id: String(row.id), teamId: String(row.team_id), title: String(row.title), startsAt: new Date(row.starts_at as string).toISOString(), theme: String(row.theme), plannedMinutes: Number(row.planned_minutes), status: row.status === "completed" ? "completed" : row.status === "planned" ? "planned" : "draft",
    blocks: blocks.filter(block => String(block.session_id) === String(row.id)).map(block => ({ id: String(block.id), exerciseId: block.exercise_id ? String(block.exercise_id) : "", title: String(block.title), minutes: Number(block.minutes), coachingPoints: block.coaching_points as string[] })),
  }));
}

export async function saveSession(input: { id?: string; title: string; theme: string; startsAt: string; plannedMinutes: number; status: "draft" | "planned" | "completed" }) {
  const team = await pilotTeam();
  if (input.id) {
    await sql`UPDATE training_sessions SET title=${input.title}, theme=${input.theme}, starts_at=${input.startsAt}, planned_minutes=${input.plannedMinutes}, status=${input.status} WHERE id=${input.id} AND team_id=${team.id}`;
  } else {
    await sql`INSERT INTO training_sessions (team_id,title,theme,starts_at,planned_minutes,status) VALUES (${team.id},${input.title},${input.theme},${input.startsAt},${input.plannedMinutes},${input.status})`;
  }
}

export async function deleteSession(id: string) {
  const team = await pilotTeam();
  await sql`DELETE FROM training_sessions WHERE id=${id} AND team_id=${team.id}`;
}

export async function setSessionStatus(id: string, status: "draft" | "planned" | "completed") {
  const team = await pilotTeam();
  await sql`UPDATE training_sessions SET status=${status} WHERE id=${id} AND team_id=${team.id}`;
}

// --- Träningsblocksbyggare ---

// Verifierar att passet tillhör pilotlaget och returnerar det
export async function getSession(id: string): Promise<{ id: string; teamId: string; title: string; theme: string; startsAt: string; plannedMinutes: number; status: string; blocks: { id: string; exerciseId: string; title: string; minutes: number; coachingPoints: string[]; coach: string | null; area: string | null; equipment: string[]; groupName: string | null }[] } | null> {
  const team = await pilotTeam();
  const rows = await sql`SELECT id, team_id, title, theme, starts_at, planned_minutes, status FROM training_sessions WHERE id=${id} AND team_id=${team.id}`;
  if (!rows[0]) return null;
  const s = rows[0];
  const blocks = await sql`SELECT id, exercise_id, title, minutes, coaching_points, coach, area, equipment, group_name FROM training_session_blocks WHERE session_id=${id} ORDER BY sort_order`;
  return {
    id: String(s.id), teamId: String(s.team_id), title: String(s.title), theme: String(s.theme),
    startsAt: new Date(s.starts_at as string).toISOString(), plannedMinutes: Number(s.planned_minutes),
    status: String(s.status),
    blocks: blocks.map(b => ({ id: String(b.id), exerciseId: b.exercise_id ? String(b.exercise_id) : "", title: String(b.title), minutes: Number(b.minutes), coachingPoints: (b.coaching_points ?? []) as string[], coach: b.coach ? String(b.coach) : null, area: b.area ? String(b.area) : null, equipment: (b.equipment ?? []) as string[], groupName: b.group_name ? String(b.group_name) : null })),
  };
}

export async function addBlock(input: { sessionId: string; exerciseId: string; title: string; minutes: number; coachingPoints: string[]; coach?: string; area?: string; equipment?: string[]; groupName?: string }) {
  const team = await pilotTeam();
  const guard = await sql`SELECT id FROM training_sessions WHERE id=${input.sessionId} AND team_id=${team.id}`;
  if (!guard[0]) throw new Error("Passet tillhör inte pilotlaget.");
  const max = await sql`SELECT COALESCE(MAX(sort_order),-1) AS m FROM training_session_blocks WHERE session_id=${input.sessionId}`;
  await sql`INSERT INTO training_session_blocks (session_id,exercise_id,title,minutes,sort_order,coaching_points,coach,area,equipment,group_name) VALUES (${input.sessionId},${input.exerciseId},${input.title},${input.minutes},${Number(max[0].m) + 1},${input.coachingPoints},${input.coach ?? null},${input.area ?? null},${input.equipment ?? []},${input.groupName ?? null})`;
}

export async function updateBlock(input: { id: string; exerciseId: string; title: string; minutes: number; coachingPoints: string[]; coach?: string; area?: string; equipment?: string[]; groupName?: string }) {
  const team = await pilotTeam();
  await sql`UPDATE training_session_blocks SET exercise_id=${input.exerciseId}, title=${input.title}, minutes=${input.minutes}, coaching_points=${input.coachingPoints}, coach=${input.coach ?? null}, area=${input.area ?? null}, equipment=${input.equipment ?? []}, group_name=${input.groupName ?? null} WHERE id=${input.id} AND session_id IN (SELECT id FROM training_sessions WHERE team_id=${team.id})`;
}

export async function deleteBlock(id: string) {
  const team = await pilotTeam();
  await sql`DELETE FROM training_session_blocks WHERE id=${id} AND session_id IN (SELECT id FROM training_sessions WHERE team_id=${team.id})`;
}

// Flytta block upp/ner — byt sort_order med granne
export async function moveBlock(id: string, dir: -1 | 1) {
  const team = await pilotTeam();
  const rows = await sql`SELECT b.id, b.sort_order, b.session_id FROM training_session_blocks b JOIN training_sessions s ON s.id=b.session_id WHERE s.team_id=${team.id} AND b.session_id=(SELECT session_id FROM training_session_blocks WHERE id=${id}) ORDER BY b.sort_order`;
  const idx = rows.findIndex(r => String(r.id) === id);
  const swap = rows[idx + dir];
  if (!swap) return;
  await sql`UPDATE training_session_blocks SET sort_order=${rows[idx].sort_order} WHERE id=${String(swap.id)}`;
  await sql`UPDATE training_session_blocks SET sort_order=${swap.sort_order} WHERE id=${id}`;
}

// --- Närvaro + genomförande ---

export type AttendanceStatus = "present" | "absent" | "late" | "partial" | "injured" | "trial";

export async function listAttendance(sessionId: string): Promise<{ playerId: string; status: AttendanceStatus }[]> {
  const team = await pilotTeam();
  const rows = await sql`SELECT a.player_id, a.status FROM training_session_attendance a JOIN training_sessions s ON s.id=a.session_id WHERE s.team_id=${team.id} AND a.session_id=${sessionId}`;
  return rows.map(r => ({ playerId: String(r.player_id), status: String(r.status) as AttendanceStatus }));
}

export async function saveAttendance(sessionId: string, entries: { playerId: string; status: AttendanceStatus }[]) {
  const team = await pilotTeam();
  const guard = await sql`SELECT id FROM training_sessions WHERE id=${sessionId} AND team_id=${team.id}`;
  if (!guard[0]) throw new Error("Passet tillhör inte pilotlaget.");
  await sql`DELETE FROM training_session_attendance WHERE session_id=${sessionId}`;
  for (const e of entries) await sql`INSERT INTO training_session_attendance (session_id,player_id,status) VALUES (${sessionId},${e.playerId},${e.status})`;
}

export type BlockDifficulty = "too_easy" | "ok" | "too_hard";
export type BlockConductStatus = "completed" | "skipped";

// Genomfört pass sparas separat från planerat — speglar blocken med faktiska avvikelser.
export async function saveConductedSession(input: {
  sessionId: string;
  overallNote: string;
  levelFeedback: string;
  followup: string;
  blocks: { blockId: string; status: BlockConductStatus; actualMinutes: number; note?: string; difficulty?: BlockDifficulty; replacedExerciseId?: string }[];
}) {
  const team = await pilotTeam();
  const guard = await sql`SELECT id FROM training_sessions WHERE id=${input.sessionId} AND team_id=${team.id}`;
  if (!guard[0]) throw new Error("Passet tillhör inte pilotlaget.");
  const [row] = await sql`INSERT INTO conducted_sessions (session_id,overall_note,level_feedback,followup) VALUES (${input.sessionId},${input.overallNote},${input.levelFeedback},${input.followup}) RETURNING id`;
  const conductedId = String(row.id);
  for (let i = 0; i < input.blocks.length; i++) {
    const b = input.blocks[i];
    await sql`INSERT INTO conducted_session_blocks (conducted_session_id,block_id,sort_order,status,actual_minutes,note,difficulty,replaced_exercise_id) VALUES (${conductedId},${b.blockId},${i},${b.status},${b.actualMinutes},${b.note ?? ""},${b.difficulty ?? null},${b.replacedExerciseId ?? null})`;
  }
}

// --- Säsongsplanering ---

// Säsongen skapas lat om den saknas (seed skapar ingen) så att "+ Ny period" fungerar på en nysådd DB.
async function ensureSeason(): Promise<string> {
  const team = await pilotTeam();
  const existing = await sql`SELECT id FROM seasons WHERE team_id=${team.id} ORDER BY starts_on DESC LIMIT 1`;
  if (existing[0]) return String(existing[0].id);
  const [row] = await sql`INSERT INTO seasons (team_id,name,starts_on,ends_on) VALUES (${team.id},'Säsong 2026','2026-04-01','2026-10-31') RETURNING id`;
  return String(row.id);
}

// ponytail: bootstrap-läs — vid tom säsong seedas 3 demoperioder en gång så sidan aldrig är öde
const DEFAULT_PERIODS: { name: string; theme: string; startsOn: string; endsOn: string }[] = [
  { name: "Trygg med boll", theme: "Första touch och spelbarhet", startsOn: "2026-04-01", endsOn: "2026-05-17" },
  { name: "Framåt tillsammans", theme: "Passning och en mot en", startsOn: "2026-05-18", endsOn: "2026-07-05" },
  { name: "Höstens försvar", theme: "Press och omställning", startsOn: "2026-08-10", endsOn: "2026-10-04" },
];

// ponytail: mappning inline — postgres Row är index-signerad, matchar stil i övriga filen
export async function listPeriods(): Promise<SeasonPeriod[]> {
  const seasonId = await ensureSeason();
  const rows = await sql`SELECT id, name, starts_on, ends_on, theme FROM season_periods WHERE season_id=${seasonId} ORDER BY starts_on`;
  if (!rows.length) {
    for (const p of DEFAULT_PERIODS)
      await sql`INSERT INTO season_periods (season_id,name,theme,starts_on,ends_on) VALUES (${seasonId},${p.name},${p.theme},${p.startsOn},${p.endsOn})`;
  }
  const periodRows = await sql`SELECT id, name, starts_on, ends_on, theme FROM season_periods WHERE season_id=${seasonId} ORDER BY starts_on`;
  const skillRows = await sql`SELECT period_id, skill_id FROM season_period_skills WHERE period_id IN (SELECT id FROM season_periods WHERE season_id=${seasonId})`;
  const skillsByPeriod = new Map<string, string[]>();
  for (const sr of skillRows) {
    const pid = String(sr.period_id);
    if (!skillsByPeriod.has(pid)) skillsByPeriod.set(pid, []);
    skillsByPeriod.get(pid)!.push(String(sr.skill_id));
  }
  return periodRows.map(row => ({ id: String(row.id), name: String(row.name), startsOn: String(row.starts_on), endsOn: String(row.ends_on), theme: String(row.theme), skillIds: skillsByPeriod.get(String(row.id)) ?? [] as string[] }));
}

export async function savePeriod(input: { id?: string; name: string; theme: string; startsOn: string; endsOn: string; skillIds: string[] }) {
  const seasonId = await ensureSeason();
  let periodId: string;
  if (input.id) {
    periodId = input.id;
    await sql`UPDATE season_periods SET name=${input.name}, theme=${input.theme}, starts_on=${input.startsOn}, ends_on=${input.endsOn} WHERE id=${input.id}`;
  } else {
    const [row] = await sql`INSERT INTO season_periods (season_id,name,theme,starts_on,ends_on) VALUES (${seasonId},${input.name},${input.theme},${input.startsOn},${input.endsOn}) RETURNING id`;
    periodId = String(row.id);
  }
  await sql`DELETE FROM season_period_skills WHERE period_id=${periodId}`;
  for (const skillId of input.skillIds) await sql`INSERT INTO season_period_skills (period_id,skill_id) VALUES (${periodId},${skillId})`;
}

// --- Färdigheter ---

// Bootstrap — vid tom skills-tabell (för pilotorg) seedas kategorier + demofärdigheter
const DEFAULT_SKILLS: { category: string; name: string }[] = [
  { category: "Passning och mottagning", name: "Första touch" },
  { category: "Spelförståelse", name: "Scanning" },
  { category: "Spelförståelse", name: "Spelbarhet" },
  { category: "Passning och mottagning", name: "Passningsprecision" },
  { category: "Dribbling och en mot en", name: "En mot en offensivt" },
  { category: "Försvarsspel", name: "Press" },
  { category: "Avslut", name: "Avslut i fart" },
  { category: "Omställningar", name: "Reaktion efter bollförlust" },
];

async function ensureSkills(): Promise<void> {
  const team = await pilotTeam();
  const existing = await sql`SELECT s.id FROM skills s JOIN skill_categories c ON c.id=s.category_id WHERE c.organization_id=${team.organizationId} LIMIT 1`;
  if (existing[0]) return;
  const categories = [...new Set(DEFAULT_SKILLS.map(s => s.category))];
  const catId: Record<string, string> = {};
  for (const name of categories) {
    const [r] = await sql`INSERT INTO skill_categories (organization_id,name) VALUES (${team.organizationId},${name}) RETURNING id`;
    catId[name] = String(r.id);
  }
  for (const s of DEFAULT_SKILLS) await sql`INSERT INTO skills (category_id,name,description) VALUES (${catId[s.category]},${s.name},${s.name + " i matchnära situationer."})`;
}

export async function listSkills(): Promise<{ id: string; name: string; category: string }[]> {
  await ensureSkills();
  const team = await pilotTeam();
  const rows = await sql`SELECT s.id, s.name, c.name AS category FROM skills s JOIN skill_categories c ON c.id=s.category_id WHERE c.organization_id=${team.organizationId} ORDER BY c.name, s.name`;
  return rows.map(r => ({ id: String(r.id), name: String(r.name), category: String(r.category) }));
}

export async function deletePeriod(id: string) {
  const team = await pilotTeam();
  await sql`DELETE FROM season_periods WHERE id=${id} AND season_id IN (SELECT id FROM seasons WHERE team_id=${team.id})`;
}

// --- Match → träning och individuell utveckling ---
export async function listMatches(): Promise<CoachMatch[]> {
  const team = await pilotTeam();
  const rows = await sql`SELECT id,opponent,starts_at,COALESCE(location,'') location,game_format,result FROM matches WHERE team_id=${team.id} ORDER BY starts_at DESC`;
  return rows.map(r => ({ id: String(r.id), opponent: String(r.opponent), startsAt: new Date(r.starts_at as string).toISOString(), location: String(r.location), gameFormat: String(r.game_format) as CoachMatch["gameFormat"], result: r.result ? String(r.result) : null }));
}

export async function saveMatch(input: Omit<CoachMatch, "id"> & { id?: string }) {
  const team = await pilotTeam();
  if (input.id) await sql`UPDATE matches SET opponent=${input.opponent},starts_at=${input.startsAt},location=${input.location || null},game_format=${input.gameFormat},result=${input.result || null} WHERE id=${input.id} AND team_id=${team.id}`;
  else { const [r] = await sql`INSERT INTO matches (team_id,opponent,starts_at,location,game_format,result) VALUES (${team.id},${input.opponent},${input.startsAt},${input.location || null},${input.gameFormat},${input.result || null}) RETURNING id`; await audit("match.created", "match", String(r.id), { opponent: input.opponent }); }
}

export async function listObservations() {
  const team = await pilotTeam();
  const rows = await sql`SELECT o.id,o.match_id,o.summary,o.sentiment,o.priority,o.player_id,o.created_at,m.opponent,m.starts_at,COALESCE(array_agg(os.skill_id) FILTER (WHERE os.skill_id IS NOT NULL),'{}') skills FROM match_observations o JOIN matches m ON m.id=o.match_id LEFT JOIN match_observation_skills os ON os.observation_id=o.id WHERE m.team_id=${team.id} GROUP BY o.id,m.opponent,m.starts_at ORDER BY o.priority DESC,o.created_at DESC`;
  return rows.map(r => ({ id: String(r.id), matchId: String(r.match_id), match: `${String(r.opponent)} · ${new Date(r.starts_at as string).toLocaleDateString("sv-SE")}`, summary: String(r.summary), sentiment: String(r.sentiment) as "positive" | "develop" | "neutral", priority: Boolean(r.priority), playerId: r.player_id ? String(r.player_id) : null, skillIds: r.skills as string[], createdAt: new Date(r.created_at as string).toISOString() }));
}

export async function saveObservation(input: { matchId: string; summary: string; sentiment: "positive" | "develop" | "neutral"; priority: boolean; playerId?: string; skillIds: string[] }) {
  const team = await pilotTeam();
  const guard = await sql`SELECT id FROM matches WHERE id=${input.matchId} AND team_id=${team.id}`;
  if (!guard[0]) throw new Error("Matchen tillhör inte pilotlaget.");
  const [r] = await sql`INSERT INTO match_observations (match_id,summary,sentiment,priority,player_id) VALUES (${input.matchId},${input.summary},${input.sentiment},${input.priority},${input.playerId || null}) RETURNING id`;
  for (const skillId of input.skillIds) await sql`INSERT INTO match_observation_skills (observation_id,skill_id) SELECT ${r.id},s.id FROM skills s JOIN skill_categories c ON c.id=s.category_id WHERE s.id=${skillId} AND c.organization_id=${team.organizationId}`;
  await audit("observation.created", "match_observation", String(r.id), { matchId: input.matchId, priority: input.priority });
}

export async function listGoals(playerId?: string): Promise<(DevelopmentGoal & { playerName: string; description: string; skills: string[] })[]> {
  const team = await pilotTeam();
  const rows = await sql`SELECT g.id,g.player_id,g.title,g.description,g.starts_on,g.ends_on,g.status,p.name player_name,COALESCE(array_agg(s.name) FILTER (WHERE s.name IS NOT NULL),'{}') skills FROM development_goals g JOIN players p ON p.id=g.player_id LEFT JOIN development_goal_skills gs ON gs.goal_id=g.id LEFT JOIN skills s ON s.id=gs.skill_id WHERE p.team_id=${team.id} AND (${playerId ?? null}::uuid IS NULL OR p.id=${playerId ?? null}::uuid) GROUP BY g.id,p.name ORDER BY CASE g.status WHEN 'active' THEN 0 WHEN 'planned' THEN 1 ELSE 2 END,g.ends_on`;
  return rows.map(r => ({ id: String(r.id), playerId: String(r.player_id), title: String(r.title), description: String(r.description), startsOn: String(r.starts_on), endsOn: String(r.ends_on), status: String(r.status) as DevelopmentGoal["status"], skillIds: [], skills: r.skills as string[], playerName: String(r.player_name) }));
}

export async function saveGoal(input: { playerId: string; title: string; description: string; startsOn: string; endsOn: string; status: DevelopmentGoal["status"]; skillIds: string[] }) {
  const team = await pilotTeam();
  const player = await sql`SELECT id FROM players WHERE id=${input.playerId} AND team_id=${team.id}`;
  if (!player[0]) throw new Error("Spelaren tillhör inte pilotlaget.");
  const [r] = await sql`INSERT INTO development_goals (player_id,title,description,starts_on,ends_on,status) VALUES (${input.playerId},${input.title},${input.description},${input.startsOn},${input.endsOn},${input.status}) RETURNING id`;
  for (const skillId of input.skillIds) await sql`INSERT INTO development_goal_skills (goal_id,skill_id) SELECT ${r.id},s.id FROM skills s JOIN skill_categories c ON c.id=s.category_id WHERE s.id=${skillId} AND c.organization_id=${team.organizationId}`;
  await audit("development_goal.created", "development_goal", String(r.id), { playerId: input.playerId });
}

export async function getAnalytics() {
  const team = await pilotTeam();
  const [sessions, attendance, goals, observations, activity] = await Promise.all([
    sql`SELECT status,COUNT(*) count FROM training_sessions WHERE team_id=${team.id} GROUP BY status`,
    sql`SELECT a.status,COUNT(*) count FROM training_session_attendance a JOIN training_sessions s ON s.id=a.session_id WHERE s.team_id=${team.id} GROUP BY a.status`,
    sql`SELECT status,COUNT(*) count FROM development_goals g JOIN players p ON p.id=g.player_id WHERE p.team_id=${team.id} GROUP BY status`,
    sql`SELECT sentiment,COUNT(*) count FROM match_observations o JOIN matches m ON m.id=o.match_id WHERE m.team_id=${team.id} GROUP BY sentiment`,
    sql`SELECT action,entity_type,created_at FROM activity_logs WHERE organization_id=${team.organizationId} ORDER BY created_at DESC LIMIT 12`,
  ]);
  return { sessions: sessions.map(r => ({ label: String(r.status), count: Number(r.count) })), attendance: attendance.map(r => ({ label: String(r.status), count: Number(r.count) })), goals: goals.map(r => ({ label: String(r.status), count: Number(r.count) })), observations: observations.map(r => ({ label: String(r.sentiment), count: Number(r.count) })), activity: activity.map(r => ({ action: String(r.action), entityType: String(r.entity_type), createdAt: new Date(r.created_at as string).toISOString() })) };
}

export async function exportPilotData() {
  const team = await pilotTeam();
  const [players, sessions, matches, observations, goals] = await Promise.all([listPlayers(), listSessions(), listMatches(), listObservations(), listGoals()]);
  await audit("data.exported", "team", team.id, { version: 1 });
  return { schemaVersion: 1, exportedAt: new Date().toISOString(), teamId: team.id, players, sessions, matches, observations, goals };
}
