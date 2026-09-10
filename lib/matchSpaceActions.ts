"use server";
import { revalidatePath } from "next/cache";
import { canAccessPlayer, getCurrentUser } from "./auth";
import { get, run } from "./db";
import { validCapacity } from "./matchSpace";
import { capacityKey } from "./matchSpaceData";

export async function saveMatchSpaceCapacity(playerId: number, form: FormData): Promise<void> {
  const actor = await getCurrentUser();
  if (!actor?.permissions.includes("manage_squads") || !(await canAccessPlayer(playerId))) throw new Error("Behörighet saknas.");
  const capacity = Number(form.get("capacity"));
  if (!Number.isInteger(playerId) || !validCapacity(capacity)) throw new Error("Ange en kapacitet mellan 50 och 150 poäng.");
  if (!(await get("SELECT id FROM players WHERE id=? AND active=1", [playerId]))) throw new Error("Spelaren är inte aktiv.");
  await run("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT (key) DO UPDATE SET value=excluded.value", [capacityKey(playerId), String(capacity)]);
  revalidatePath(`/spelare/${playerId}`);
  revalidatePath("/idag");
  revalidatePath("/matcher", "layout");
}
