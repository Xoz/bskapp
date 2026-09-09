"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, canAccessPlayer } from "./auth";
import { all, get, run } from "./db";
import {
  prepareTreeConversation,
  realDate,
  type TreeRow,
} from "./treeConversation";

export async function saveTreeConversation(
  playerId: number,
  form: FormData,
): Promise<{ saved?: boolean; error?: string }> {
  const actor = await getCurrentUser();
  if (
    !actor ||
    !actor.permissions.includes("manage_evaluations") ||
    !actor.permissions.includes("view_private_player_data") ||
    !Number.isInteger(playerId) ||
    playerId < 1 ||
    !(await canAccessPlayer(playerId))
  )
    return { error: "Du saknar behörighet till spelarens samtal." };
  const id = String(form.get("command_id") || "");
  const date = String(form.get("conversation_date") || "");
  const sourceId = String(form.get("checkpoint_id") || "");
  const outcome = String(form.get("outcome") || "");
  const note = String(form.get("note") || "").trim();
  const perspective = String(form.get("player_perspective") || "").trim();
  const custom = String(form.get("agreed_actions") || "").trim();
  const followUp = String(form.get("follow_up_on") || "");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    ) ||
    !realDate(date) ||
    (followUp && !realDate(followUp)) ||
    !["continue", "custom", "none"].includes(outcome) ||
    note.length > 1000 ||
    perspective.length > 4000 ||
    custom.length > 4000
  )
    return { error: "Kontrollera datum och val för samtalet." };
  const source = sourceId
    ? await get<{ id: string; date: string }>(
        "SELECT id,date FROM development_checkpoints WHERE id = ? AND player_id = ?",
        [sourceId, playerId],
      )
    : undefined;
  if (sourceId && (!source || source.date > date))
    return {
      error:
        "Underlaget saknas eller är daterat efter samtalet. Öppna ett giltigt underlag från spelarbilden.",
    };
  const rows = source
    ? await all<TreeRow>(
        "SELECT skill_id,status,is_focus FROM development_checkpoint_skills WHERE checkpoint_id = ?",
        [source.id],
      )
    : [];
  const preparation = prepareTreeConversation(
    source?.id ?? null,
    source?.date ?? null,
    rows,
  );
  if (outcome === "continue" && !preparation.focus.length)
    return {
      error: "Välj först ett fokus i trädet, eller välj ett annat nästa steg.",
    };
  if (outcome === "custom" && !custom)
    return {
      error:
        "Skriv ert nya nästa steg eller välj att ingen ny överenskommelse gjordes.",
    };
  const agreement =
    outcome === "continue"
      ? `Vi fortsätter med valt fokus: ${preparation.focus.map((f) => f.title).join("; ")}.`
      : outcome === "none"
        ? "Ingen ny överenskommelse gjordes vid samtalet."
        : custom;
  const summary =
    preparation.summary + (note ? `\n\nTränarens tillägg: ${note}` : "");
  if (summary.length > 4000)
    return { error: "Underlaget är för långt. Korta den extra noteringen." };
  // The command id is also the existing table's primary key. No new data store.
  await run(
    `INSERT INTO player_conversations
    (id,player_id,conversation_date,coach_name,coach_summary,player_perspective,agreed_actions,follow_up_on,development_checkpoint_id)
    VALUES (?,?,?,?,?,?,?,NULLIF(?,''),?) ON CONFLICT(id) DO NOTHING`,
    [
      id,
      playerId,
      date,
      actor.name,
      summary,
      perspective,
      agreement,
      followUp,
      source?.id ?? null,
    ],
  );
  const stored = await get<{
    player_id: number;
    conversation_date: string;
    coach_summary: string;
    player_perspective: string;
    agreed_actions: string;
    follow_up_on: string | null;
    development_checkpoint_id: string | null;
  }>(
    "SELECT player_id,conversation_date,coach_summary,player_perspective,agreed_actions,follow_up_on,development_checkpoint_id FROM player_conversations WHERE id = ?",
    [id],
  );
  if (
    !stored ||
    stored.player_id !== playerId ||
    stored.conversation_date !== date ||
    stored.coach_summary !== summary ||
    stored.player_perspective !== perspective ||
    stored.agreed_actions !== agreement ||
    (stored.follow_up_on || "") !== followUp ||
    (stored.development_checkpoint_id || "") !== sourceId
  )
    return {
      error:
        "Sparförsöket har redan använts för ett annat innehåll. Din text finns kvar; börja ett nytt samtal efter kontroll av historiken.",
    };
  revalidatePath(`/spelare/${playerId}`);
  return { saved: true };
}
