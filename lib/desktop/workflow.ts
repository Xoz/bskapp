import type { Match } from '../queries';
export type Stage = 'prepare' | 'perform' | 'review';
export type WorkflowAction = { title: string; path: string };
export type WorkflowMatch = {
  id: number; title: string; date: string; time: string | null; location: string;
  team: string; stage: Stage; planSaved: boolean; selected: number; accepted: number;
  evaluated: number; total: number; preparation: string;
  actions: Record<Stage, WorkflowAction[]>; next: WorkflowAction;
};
export function workflowMatch(input: {
  match: Match; today: string; team: string; planSaved: boolean; selected: number; accepted: number;
  evaluation: { total: number; evaluated: number }; evaluationOpen: boolean;
  canSelect: boolean; canEvaluate: boolean; canPlayers: boolean;
}): WorkflowMatch {
  const { match: m, today, team, planSaved, selected, accepted, evaluation, evaluationOpen } = input;
  const path = `/matcher/${m.id}`;
  const stage: Stage = m.finished || m.date < today || evaluationOpen ? 'review' : m.date === today ? 'perform' : 'prepare';
  const actions: WorkflowMatch['actions'] = {
    prepare: [
      ...(input.canSelect ? [{ title: 'Välj laguppställning', path: `${path}/laguttagning` }] : []),
      { title: 'Öppna matchplan', path: `${path}#matchplan` },
      ...(input.canSelect && input.canPlayers && !m.finished && m.date >= today ? [{ title: 'Matchutrymme och kallelser', path: `${path}/matchutrymme` }] : []),
    ],
    perform: [{ title: 'Visa matchplan', path: `${path}#matchplan` }, { title: 'Visa trupp', path: `${path}#trupp` }],
    review: [
      ...(input.canEvaluate && team === 'Gul' && evaluationOpen ? [{ title: evaluation.evaluated ? 'Fortsätt utvärdera' : 'Utvärdera matchen', path: `${path}/utvardera` }] : []),
      ...(input.canPlayers ? [{ title: 'Öppna spelarutveckling', path: '/utveckling' }] : []),
      { title: 'Visa matchöversikt', path },
    ],
  };
  const next = stage === 'prepare' && (!input.canSelect || selected > 0) ? actions.prepare.find(a => a.path.endsWith('#matchplan'))! : actions[stage][0];
  return {
    id: m.id, title: `${m.home_away === 'home' ? 'Hemma' : 'Borta'} mot ${m.opponent}`,
    date: m.date, time: m.start_time, location: m.location || '', team, stage, planSaved,
    selected, accepted, evaluated: evaluation.evaluated, total: evaluation.total,
    preparation: `${selected} uttagna · ${accepted} tackat ja · ${planSaved ? 'matchplan sparad' : 'ingen sparad matchplan'}`,
    actions, next,
  };
}
