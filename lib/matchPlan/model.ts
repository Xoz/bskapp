import { FORMATIONS, type Formation } from '../formations';

export const MATCH_FORMATIONS: Formation[] = [
  ...FORMATIONS,
  { id: '1-3-2-1', label: '1-3-2-1', slots: [
    { role: 'gk', x: .5, y: .9 }, { role: 'def', x: .2, y: .7 },
    { role: 'def', x: .5, y: .7 }, { role: 'def', x: .8, y: .7 },
    { role: 'mid', x: .3, y: .45 }, { role: 'mid', x: .7, y: .45 },
    { role: 'fwd', x: .5, y: .18 },
  ] },
  { id: '1-2-2-2', label: '1-2-2-2', slots: [
    { role: 'gk', x: .5, y: .9 }, { role: 'def', x: .3, y: .7 },
    { role: 'def', x: .7, y: .7 }, { role: 'mid', x: .3, y: .45 },
    { role: 'mid', x: .7, y: .45 }, { role: 'fwd', x: .3, y: .18 },
    { role: 'fwd', x: .7, y: .18 },
  ] },
];
export const IDEA_FIELDS = [
  { key: 'focus', label: 'Vårt viktigaste fokus', placeholder: 'Vad ska spelarna komma ihåg när de går ut på planen?' },
  { key: 'attack', label: 'När vi har bollen', placeholder: 'Hur vill vi starta anfallen, skapa ytor och komma till avslut?' },
  { key: 'defend', label: 'När motståndaren har bollen', placeholder: 'Var börjar vi pressa och hur hjälper vi varandra?' },
  { key: 'transition', label: 'När vi vinner eller tappar bollen', placeholder: 'Vad gör vi direkt efter bollvinst och bollförlust?' },
] as const;
export type MatchPlan = {
  formation: string;
  spots: { playerId: number | null; x: number; y: number }[];
  ideas: Record<typeof IDEA_FIELDS[number]['key'], string>;
};
export type SavedMatchPlan = { revision: number; document: MatchPlan };
export function emptyMatchPlan(formationId?: string): MatchPlan {
  const fm = MATCH_FORMATIONS.find(f => f.id === formationId) ?? MATCH_FORMATIONS[0];
  return { formation: fm.id, spots: fm.slots.map(s => ({ playerId: null, x: s.x, y: s.y })),
    ideas: { focus: '', attack: '', defend: '', transition: '' } };
}
export function validMatchPlan(value: unknown): value is MatchPlan {
  if (!value || typeof value !== 'object') return false;
  const p = value as MatchPlan;
  if (!MATCH_FORMATIONS.some(f => f.id === p.formation) || !Array.isArray(p.spots) || p.spots.length !== 7) return false;
  if (!p.spots.every(s => s && (s.playerId === null || (Number.isSafeInteger(s.playerId) && s.playerId > 0))
    && Number.isFinite(s.x) && s.x >= .08 && s.x <= .92 && Number.isFinite(s.y) && s.y >= .08 && s.y <= .92)) return false;
  const ids = p.spots.flatMap(s => s.playerId === null ? [] : [s.playerId]);
  return new Set(ids).size === ids.length && !!p.ideas
    && IDEA_FIELDS.every(f => typeof p.ideas[f.key] === 'string' && p.ideas[f.key].length <= 2000);
}
export function readMatchPlan(raw: string): SavedMatchPlan | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    return Number.isSafeInteger(p.revision) && p.revision > 0 && validMatchPlan(p.document) ? p : null;
  } catch { return null; }
}
