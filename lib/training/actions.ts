"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { get, run } from "@/lib/db";
import { validPlan } from "./model";
export async function saveTrainingPlan(
  id: string,
  revision: number,
  document: unknown,
): Promise<{ revision?: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user?.permissions.includes("manage_evaluations"))
    return { error: "Du saknar behörighet att planera träning." };
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    ) ||
    !Number.isInteger(revision) ||
    revision < 0 ||
    !validPlan(document)
  )
    return { error: "Kontrollera passets namn, minuter och ritningar." };
  const json = JSON.stringify(document);
  if (Buffer.byteLength(json) > 1_000_000)
    return { error: "Passet är för stort. Dela upp det i flera pass." };
  if (revision === 0)
    await run(
      "INSERT INTO training_plans (id,created_by,document) VALUES (?,?,?::text::jsonb) ON CONFLICT(id) DO NOTHING",
      [id, user.id, json],
    );
  else
    await run(
      "UPDATE training_plans SET document=?::text::jsonb,revision=revision+1,updated_at=now() WHERE id=? AND created_by=? AND revision=?",
      [json, id, user.id, revision],
    );
  // Includes an identical replay after a lost response. Never overwrite another revision/owner.
  const saved = await get<{ revision: number }>(
    "SELECT revision FROM training_plans WHERE id=? AND created_by=? AND revision=? AND document=?::text::jsonb",
    [id, user.id, revision + 1, json],
  );
  if (!saved)
    return {
      error:
        "Passet har ändrats i en annan flik eller är inte tillgängligt. Ditt utkast finns kvar. Öppna senaste sparade versionen innan du fortsätter.",
    };
  revalidatePath("/traning");
  revalidatePath(`/traning/${id}`);
  return { revision: saved.revision };
}
