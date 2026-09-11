import type { MatchPlan } from './model';

export async function persistMatchPlan(matchId: number, revision: number, document: MatchPlan): Promise<{ revision?: number; error?: string }> {
  const response = await fetch(`/api/matches/${matchId}/plan`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ revision, document }),
  });
  const result = await response.json();
  if (result && typeof result.error === 'string') return { error: result.error };
  if (!response.ok || !Number.isSafeInteger(result?.revision) || result.revision !== revision + 1)
    throw new Error('Matchplanen saknar sparbekräftelse');
  return { revision: result.revision };
}
