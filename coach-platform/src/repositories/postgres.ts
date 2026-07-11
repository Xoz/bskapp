import postgres from "postgres";
import type { Diagram } from "@/domain/diagram";
import type { Exercise, Player, TrainingSession } from "@/domain/model";

const sql = postgres(process.env.DATABASE_URL ?? "postgres://coach:coach@localhost:5434/coach", { max: 5 });

async function pilotTeam() {
  const requestedId = process.env.PILOT_TEAM_ID;
  const rows = requestedId
    ? await sql`SELECT id, organization_id FROM teams WHERE id = ${requestedId} LIMIT 1`
    : await sql`SELECT id, organization_id FROM teams ORDER BY created_at LIMIT 1`;
  if (!rows[0]) throw new Error("Pilotlaget saknas. Kör npm run db:seed.");
  return { id: String(rows[0].id), organizationId: String(rows[0].organization_id) };
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
  const obj = JSON.stringify(diagram.objects);
  const act = JSON.stringify(diagram.arrows);
  if (existing[0]) {
    await sql`UPDATE exercise_diagrams SET objects=${obj}::jsonb, actions=${act}::jsonb, width_ratio=${diagram.widthRatio} WHERE id=${existing[0].id}`;
  } else {
    await sql`INSERT INTO exercise_diagrams (exercise_id, version, width_ratio, objects, actions) VALUES (${exerciseId}, 1, ${diagram.widthRatio}, ${obj}::jsonb, ${act}::jsonb)`;
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

export async function saveSession(input: { id?: string; title: string; theme: string; startsAt: string; plannedMinutes: number; status: "draft" | "planned" }) {
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
