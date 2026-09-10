'use server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, canAccessGroup } from '../auth';
import { get, run } from '../db';
import { validMatchPlan } from './model';

export async function saveMatchPlan(matchId: number, revision: number, document: unknown): Promise<{ revision?: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user?.permissions.includes('manage_squads')) return { error: 'Du saknar behörighet att ändra matchplanen.' };
  if (!Number.isSafeInteger(matchId) || matchId <= 0 || !Number.isSafeInteger(revision) || revision < 0 || !validMatchPlan(document))
    return { error: 'Kontrollera formation, spelarplacering och texter (högst 2 000 tecken per fält).' };
  const match = await get<{ group_id: number | null; cancelled: number }>('SELECT group_id, cancelled FROM matches WHERE id = ?', [matchId]);
  if (!match || !await canAccessGroup(match.group_id)) return { error: 'Du saknar åtkomst till matchen.' };
  if (match.cancelled) return { error: 'Matchen är inställd eller borttagen.' };
  const key = `match_plan:${matchId}`;
  const json = JSON.stringify({ revision: revision + 1, document });
  const ids = document.spots.flatMap(s => s.playerId === null ? [] : [s.playerId]);
  // Matchlåset samordnar med truppändringar och synk. Matchplanen skriver bara
  // sin egen settings-post: inga kallelser, uttagningar eller närvarorader.
  const rows = await run(`WITH locked_match AS MATERIALIZED (
      SELECT id FROM matches WHERE id = ? AND COALESCE(cancelled, 0) = 0 FOR UPDATE
    )
    INSERT INTO settings(key, value)
    SELECT ?, ? FROM locked_match m
    WHERE NOT EXISTS (
      SELECT pid FROM jsonb_array_elements_text(?::text::jsonb) AS wanted(pid)
      WHERE NOT EXISTS (SELECT 1 FROM match_roster mr WHERE mr.match_id = m.id
        AND mr.player_id = wanted.pid::int AND mr.selection_status = 'selected')
    ) AND (? = 0 OR EXISTS (SELECT 1 FROM settings WHERE key = ?))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
      WHERE (settings.value::jsonb->>'revision')::int = ? OR settings.value = excluded.value
    RETURNING value`, [matchId, key, json, JSON.stringify(ids), revision, key, revision]);
  if (!rows.length) return { error: 'Truppen eller matchplanen har ändrats. Ladda om sidan och kontrollera innan du sparar igen.' };
  revalidatePath(`/matcher/${matchId}`);
  return { revision: revision + 1 };
}
