"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { diagramSchema } from "@/domain/diagram";
import type { Diagram } from "@/domain/diagram";
import { deleteExercise, deletePeriod, deletePlayer, deleteBlock, deleteSession, getExercise, getPlayerName, moveBlock, saveAttendance, saveConductedSession, saveDiagram, saveExercise, savePeriod, savePlayer, saveSession, setPlayerStatus, setSessionStatus, addBlock, updateBlock } from "@/repositories/postgres";
import type { AttendanceStatus, BlockConductStatus, BlockDifficulty } from "@/repositories/postgres";
import { saveGoal, saveMatch, saveObservation } from "@/repositories/postgres";
import { developmentGoalSchema, matchSchema, observationSchema } from "@/schemas/domain";
import { requireCoachIdentity, requireHeadCoachIdentity } from "@/lib/coach-session";

const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const number = (data: FormData, key: string) => Number(data.get(key));

export async function upsertPlayer(data: FormData) {
  await requireCoachIdentity();
  const name = text(data, "name");
  const birthYear = number(data, "birthYear");
  const shirtNumber = number(data, "number");
  if (name.length < 2 || birthYear < 2000 || birthYear > new Date().getFullYear()) throw new Error("Kontrollera spelarens namn och födelseår.");
  await savePlayer({ id: text(data, "id") || undefined, name, birthYear, number: shirtNumber || undefined, positions: text(data, "positions").split(",").map(value => value.trim()).filter(Boolean) });
  revalidatePath("/spelare");
}

export async function restrictPlayer(data: FormData) {
  await requireCoachIdentity();
  await setPlayerStatus(text(data, "id"), "paused");
  revalidatePath("/spelare");
}

export async function reactivatePlayer(data: FormData) {
  await requireCoachIdentity();
  await setPlayerStatus(text(data, "id"), "active");
  revalidatePath("/spelare");
}

export async function removePlayer(data: FormData) {
  await requireHeadCoachIdentity();
  const id = text(data, "id");
  const expectedName = await getPlayerName(id);
  if (!expectedName || text(data, "confirmation") !== expectedName) throw new Error("Skriv spelarens fullständiga namn för att bekräfta permanent radering.");
  await deletePlayer(id);
  revalidatePath("/spelare");
}

export async function upsertExercise(data: FormData) {
  await requireCoachIdentity();
  const input = { id: text(data, "id") || undefined, name: text(data, "name"), summary: text(data, "summary"), durationMinutes: number(data, "durationMinutes"), minPlayers: number(data, "minPlayers"), maxPlayers: number(data, "maxPlayers") };
  if (input.name.length < 2 || input.summary.length < 2 || input.durationMinutes < 1 || input.minPlayers < 1 || input.maxPlayers < input.minPlayers) throw new Error("Kontrollera övningens uppgifter.");
  await saveExercise(input);
  revalidatePath("/ovningar");
}

export async function removeExercise(data: FormData) { await requireCoachIdentity(); await deleteExercise(text(data, "id")); revalidatePath("/ovningar"); }

export async function saveExerciseDiagram(exerciseId: string, diagram: Diagram) {
  await requireCoachIdentity();
  const parsed = diagramSchema.parse(diagram);
  await saveDiagram(exerciseId, parsed);
  revalidatePath(`/ovningar/${exerciseId}/ritare`);
}

export async function upsertSession(data: FormData) {
  await requireCoachIdentity();
  const status = text(data, "status");
  const input = { id: text(data, "id") || undefined, title: text(data, "title"), theme: text(data, "theme"), startsAt: text(data, "startsAt"), plannedMinutes: number(data, "plannedMinutes"), status: (status === "planned" ? "planned" : status === "completed" ? "completed" : "draft") as "draft" | "planned" | "completed" };
  if (input.title.length < 2 || input.theme.length < 2 || !Number.isFinite(Date.parse(input.startsAt)) || input.plannedMinutes < 1) throw new Error("Kontrollera träningspassets uppgifter.");
  await saveSession(input);
  revalidatePath("/traningspass");
}

export async function removeSession(data: FormData) { await requireCoachIdentity(); await deleteSession(text(data, "id")); revalidatePath("/traningspass"); }

export async function completeSessionAction(data: FormData) {
  await requireCoachIdentity();
  const id = text(data, "id");
  const status = (text(data, "status") === "planned" ? "planned" : "completed") as "planned" | "completed";
  await setSessionStatus(id, status);
  revalidatePath(`/traningspass/${id}`);
  revalidatePath("/traningspass");
}

const ATTENDANCE_STATUSES: AttendanceStatus[] = ["present", "absent", "late", "partial", "injured", "trial"];

export async function saveAttendanceAction(data: FormData) {
  await requireCoachIdentity();
  const sessionId = text(data, "sessionId");
  const entries: { playerId: string; status: AttendanceStatus }[] = [];
  for (const [key, value] of data.entries()) {
    if (!key.startsWith("att_")) continue;
    const playerId = key.slice(4);
    const status = String(value) as AttendanceStatus;
    if (playerId && ATTENDANCE_STATUSES.includes(status)) entries.push({ playerId, status });
  }
  await saveAttendance(sessionId, entries);
  revalidatePath(`/traningspass/${sessionId}`);
}

const CONDUCT_STATUSES: BlockConductStatus[] = ["completed", "skipped"];
const DIFFICULTIES: BlockDifficulty[] = ["too_easy", "ok", "too_hard"];

export async function saveConductAction(data: FormData) {
  await requireCoachIdentity();
  const sessionId = text(data, "sessionId");
  const blockIds = (data.getAll("blockId") as string[]).filter(Boolean);
  const blocks: { blockId: string; status: BlockConductStatus; actualMinutes: number; note?: string; difficulty?: BlockDifficulty; replacedExerciseId?: string }[] = [];
  for (const blockId of blockIds) {
    const status = String(data.get(`status_${blockId}`));
    if (!CONDUCT_STATUSES.includes(status as BlockConductStatus)) continue;
    const difficulty = String(data.get(`difficulty_${blockId}`) ?? "");
    blocks.push({
      blockId,
      status: status as BlockConductStatus,
      actualMinutes: Number(data.get(`actualMinutes_${blockId}`) ?? 0) || 0,
      note: text(data, `note_${blockId}`) || undefined,
      difficulty: DIFFICULTIES.includes(difficulty as BlockDifficulty) ? difficulty as BlockDifficulty : undefined,
      replacedExerciseId: text(data, `replaced_${blockId}`) || undefined,
    });
  }
  await saveConductedSession({ sessionId, overallNote: text(data, "overallNote"), levelFeedback: text(data, "levelFeedback"), followup: text(data, "followup"), blocks });
  // Spara även närvaro om den skickades med (att_-fält), så allt sparas i ett steg vid avslut
  const attEntries: { playerId: string; status: AttendanceStatus }[] = [];
  for (const [key, value] of data.entries()) {
    if (!key.startsWith("att_")) continue;
    const playerId = key.slice(4);
    const status = String(value) as AttendanceStatus;
    if (playerId && ATTENDANCE_STATUSES.includes(status)) attEntries.push({ playerId, status });
  }
  if (attEntries.length) await saveAttendance(sessionId, attEntries);
  await setSessionStatus(sessionId, "completed");
  revalidatePath(`/traningspass/${sessionId}`);
  revalidatePath("/traningspass");
  redirect(`/traningspass/${sessionId}`);
}

const coachingPoints = (data: FormData) => text(data, "coachingPoints").split(/[,;]|\n/).map(s => s.trim()).filter(Boolean);
const splitList = (data: FormData, key: string) => text(data, key).split(/[,;]|\n/).map(s => s.trim()).filter(Boolean);

export async function upsertBlock(data: FormData) {
  await requireCoachIdentity();
  const id = text(data, "id") || undefined;
  const sessionId = text(data, "sessionId");
  const exerciseId = text(data, "exerciseId");
  const minutes = number(data, "minutes");
  const exercise = await getExercise(exerciseId);
  if (!exercise) throw new Error("Övningen finns inte i pilotorganisationen.");
  if (!sessionId || minutes < 1) throw new Error("Kontrollera blocket (minuter).");
  const points = coachingPoints(data);
  const meta = { coach: text(data, "coach") || undefined, area: text(data, "area") || undefined, equipment: splitList(data, "equipment"), groupName: text(data, "groupName") || undefined };
  if (id) await updateBlock({ id, exerciseId, title: exercise.name, minutes, coachingPoints: points, ...meta });
  else await addBlock({ sessionId, exerciseId, title: exercise.name, minutes, coachingPoints: points, ...meta });
  revalidatePath(`/traningspass/${sessionId}`);
}

export async function removeBlock(data: FormData) {
  await requireCoachIdentity();
  const sessionId = text(data, "sessionId");
  await deleteBlock(text(data, "id"));
  if (sessionId) revalidatePath(`/traningspass/${sessionId}`);
}

export async function moveBlockAction(data: FormData) {
  await requireCoachIdentity();
  const sessionId = text(data, "sessionId");
  await moveBlock(text(data, "id"), text(data, "dir") === "up" ? -1 : 1);
  if (sessionId) revalidatePath(`/traningspass/${sessionId}`);
}

export async function upsertPeriod(data: FormData) {
  await requireCoachIdentity();
  const id = text(data, "id") || undefined;
  const name = text(data, "name");
  const theme = text(data, "theme");
  const startsOn = text(data, "startsOn");
  const endsOn = text(data, "endsOn");
  const skillIds = (data.getAll("skillIds") as string[]).filter(Boolean);
  if (name.length < 2 || theme.length < 2 || !Number.isFinite(Date.parse(startsOn)) || !Number.isFinite(Date.parse(endsOn)) || new Date(startsOn) > new Date(endsOn))
    throw new Error("Kontrollera periodens namn, tema och datum (start ≤ slut).");
  await savePeriod({ id, name, theme, startsOn, endsOn, skillIds });
  revalidatePath("/planering");
}

export async function removePeriod(data: FormData) { await requireCoachIdentity(); await deletePeriod(text(data, "id")); revalidatePath("/planering"); }

export async function createMatchAction(data: FormData) {
  await requireCoachIdentity();
  const parsed = matchSchema.parse({ opponent: text(data, "opponent"), startsAt: new Date(text(data, "startsAt")).toISOString(), location: text(data, "location"), gameFormat: text(data, "gameFormat"), result: text(data, "result") });
  await saveMatch(parsed); revalidatePath("/matcher");
}

export async function createObservationAction(data: FormData) {
  await requireCoachIdentity();
  const parsed = observationSchema.parse({ matchId: text(data, "matchId"), summary: text(data, "summary"), sentiment: text(data, "sentiment"), playerId: text(data, "playerId") || undefined, skillIds: (data.getAll("skillIds") as string[]).filter(Boolean), priority: data.get("priority") === "on" });
  await saveObservation(parsed); revalidatePath("/matcher"); revalidatePath("/");
}

export async function createGoalAction(data: FormData) {
  await requireCoachIdentity();
  const parsed = developmentGoalSchema.parse({ playerId: text(data, "playerId"), title: text(data, "title"), description: text(data, "description"), startsOn: text(data, "startsOn"), endsOn: text(data, "endsOn"), status: text(data, "status"), skillIds: (data.getAll("skillIds") as string[]).filter(Boolean) });
  await saveGoal(parsed); revalidatePath("/spelare"); revalidatePath("/analys");
}
