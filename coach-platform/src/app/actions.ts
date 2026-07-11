"use server";

import { revalidatePath } from "next/cache";
import { diagramSchema } from "@/domain/diagram";
import type { Diagram } from "@/domain/diagram";
import { deleteExercise, deletePeriod, deletePlayer, deleteBlock, deleteSession, getExercise, moveBlock, saveAttendance, saveDiagram, saveExercise, savePeriod, savePlayer, saveSession, setSessionStatus, addBlock, updateBlock } from "@/repositories/postgres";
import type { AttendanceStatus } from "@/repositories/postgres";

const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const number = (data: FormData, key: string) => Number(data.get(key));

export async function upsertPlayer(data: FormData) {
  const name = text(data, "name");
  const birthYear = number(data, "birthYear");
  const shirtNumber = number(data, "number");
  if (name.length < 2 || birthYear < 2000 || birthYear > new Date().getFullYear()) throw new Error("Kontrollera spelarens namn och födelseår.");
  await savePlayer({ id: text(data, "id") || undefined, name, birthYear, number: shirtNumber || undefined, positions: text(data, "positions").split(",").map(value => value.trim()).filter(Boolean) });
  revalidatePath("/spelare");
}

export async function removePlayer(data: FormData) { await deletePlayer(text(data, "id")); revalidatePath("/spelare"); }

export async function upsertExercise(data: FormData) {
  const input = { id: text(data, "id") || undefined, name: text(data, "name"), summary: text(data, "summary"), durationMinutes: number(data, "durationMinutes"), minPlayers: number(data, "minPlayers"), maxPlayers: number(data, "maxPlayers") };
  if (input.name.length < 2 || input.summary.length < 2 || input.durationMinutes < 1 || input.minPlayers < 1 || input.maxPlayers < input.minPlayers) throw new Error("Kontrollera övningens uppgifter.");
  await saveExercise(input);
  revalidatePath("/ovningar");
}

export async function removeExercise(data: FormData) { await deleteExercise(text(data, "id")); revalidatePath("/ovningar"); }

export async function saveExerciseDiagram(exerciseId: string, diagram: Diagram) {
  const parsed = diagramSchema.parse(diagram);
  await saveDiagram(exerciseId, parsed);
  revalidatePath(`/ovningar/${exerciseId}/ritare`);
}

export async function upsertSession(data: FormData) {
  const status = text(data, "status");
  const input = { id: text(data, "id") || undefined, title: text(data, "title"), theme: text(data, "theme"), startsAt: text(data, "startsAt"), plannedMinutes: number(data, "plannedMinutes"), status: (status === "planned" ? "planned" : status === "completed" ? "completed" : "draft") as "draft" | "planned" | "completed" };
  if (input.title.length < 2 || input.theme.length < 2 || !Number.isFinite(Date.parse(input.startsAt)) || input.plannedMinutes < 1) throw new Error("Kontrollera träningspassets uppgifter.");
  await saveSession(input);
  revalidatePath("/traningspass");
}

export async function removeSession(data: FormData) { await deleteSession(text(data, "id")); revalidatePath("/traningspass"); }

export async function completeSessionAction(data: FormData) {
  const id = text(data, "id");
  const status = (text(data, "status") === "planned" ? "planned" : "completed") as "planned" | "completed";
  await setSessionStatus(id, status);
  revalidatePath(`/traningspass/${id}`);
  revalidatePath("/traningspass");
}

const ATTENDANCE_STATUSES: AttendanceStatus[] = ["present", "absent", "late", "partial", "injured", "trial"];

export async function saveAttendanceAction(data: FormData) {
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

const coachingPoints = (data: FormData) => text(data, "coachingPoints").split(/[,;]|\n/).map(s => s.trim()).filter(Boolean);

export async function upsertBlock(data: FormData) {
  const id = text(data, "id") || undefined;
  const sessionId = text(data, "sessionId");
  const exerciseId = text(data, "exerciseId");
  const minutes = number(data, "minutes");
  const exercise = await getExercise(exerciseId);
  if (!exercise) throw new Error("Övningen finns inte i pilotorganisationen.");
  if (!sessionId || minutes < 1) throw new Error("Kontrollera blocket (minuter).");
  const points = coachingPoints(data);
  if (id) await updateBlock({ id, exerciseId, title: exercise.name, minutes, coachingPoints: points });
  else await addBlock({ sessionId, exerciseId, title: exercise.name, minutes, coachingPoints: points });
  revalidatePath(`/traningspass/${sessionId}`);
}

export async function removeBlock(data: FormData) {
  const sessionId = text(data, "sessionId");
  await deleteBlock(text(data, "id"));
  if (sessionId) revalidatePath(`/traningspass/${sessionId}`);
}

export async function moveBlockAction(data: FormData) {
  const sessionId = text(data, "sessionId");
  await moveBlock(text(data, "id"), text(data, "dir") === "up" ? -1 : 1);
  if (sessionId) revalidatePath(`/traningspass/${sessionId}`);
}

export async function upsertPeriod(data: FormData) {
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

export async function removePeriod(data: FormData) { await deletePeriod(text(data, "id")); revalidatePath("/planering"); }
