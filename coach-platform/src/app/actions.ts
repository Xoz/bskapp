"use server";

import { revalidatePath } from "next/cache";
import { deleteExercise, deletePlayer, deleteSession, saveExercise, savePlayer, saveSession } from "@/repositories/postgres";

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

export async function upsertSession(data: FormData) {
  const input = { id: text(data, "id") || undefined, title: text(data, "title"), theme: text(data, "theme"), startsAt: text(data, "startsAt"), plannedMinutes: number(data, "plannedMinutes"), status: text(data, "status") === "planned" ? "planned" as const : "draft" as const };
  if (input.title.length < 2 || input.theme.length < 2 || !Number.isFinite(Date.parse(input.startsAt)) || input.plannedMinutes < 1) throw new Error("Kontrollera träningspassets uppgifter.");
  await saveSession(input);
  revalidatePath("/traningspass");
}

export async function removeSession(data: FormData) { await deleteSession(text(data, "id")); revalidatePath("/traningspass"); }
