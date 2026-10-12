import { getCurrentUser, isStaffRole } from '../auth';
import { all } from '../db';
import { getMatches } from '../queries';
import { getOrganizationGroups } from '../organization';
import { getMatchEvaluationStatus, matchEvaluationIsOpen } from '../matchEvaluation';
import { readMatchPlan } from '../matchPlan/model';
import { swedishToday } from '../dates';
import { workflowMatch } from './workflow';

export async function desktopWorkspace(requestedMatch?: number) {
  const user = await getCurrentUser();
  if (!user) return { status: 401, body: { error: 'Logga in för att öppna arbetsbordet.' } };
  if (!isStaffRole(user.primaryRole) || !user.permissions.includes('view_matches'))
    return { status: 403, body: { error: 'Du saknar behörighet till arbetsbordet.' } };
  const today = swedishToday();
  const [allMatches, groups] = await Promise.all([getMatches(), getOrganizationGroups()]);
  // getMatches applies the same group scope as the web. Never use a requested ID
  // to bypass that scope. Limit enrichment, including older explicitly opened matches.
  const cutoff = new Date(`${today}T12:00:00Z`); cutoff.setUTCDate(cutoff.getUTCDate() - 7);
  const recentDate = cutoff.toISOString().slice(0, 10);
  const upcoming = allMatches.filter(m => !m.cancelled && !m.finished && m.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start_time || '23:59').localeCompare(b.start_time || '23:59') || a.id - b.id).slice(0, 20);
  const recent = allMatches.filter(m => !m.cancelled && (m.date < today || !!m.finished) && m.date >= recentDate && m.date <= today).slice(0, 10);
  const requested = allMatches.find(m => m.id === requestedMatch && !m.cancelled);
  const matches = [...new Map([...upcoming, ...recent, ...(requested ? [requested] : [])].map(m => [m.id, m])).values()];
  const ids = matches.map(m => m.id);
  const marks = ids.map(() => '?').join(',');
  const [counts, plans, training] = await Promise.all([
    ids.length ? all<{ match_id: number; selected: number; accepted: number }>(`SELECT match_id,
      COUNT(*) FILTER (WHERE selection_status='selected')::int AS selected,
      COUNT(*) FILTER (WHERE callup_status='accepted')::int AS accepted
      FROM match_roster WHERE match_id IN (${marks}) GROUP BY match_id`, ids) : [],
    ids.length ? all<{ key: string; value: string }>(`SELECT key,value FROM settings WHERE key IN (${marks})`, ids.map(id => `match_plan:${id}`)) : [],
    user.permissions.includes('manage_evaluations') ? all<{ id: string; title: string; date: string }>(
      "SELECT id,document->>'title' AS title,COALESCE(document->>'date','') AS date FROM training_plans WHERE created_by=? ORDER BY updated_at DESC LIMIT 4", [user.id]) : [],
  ]);
  const result = await Promise.all(matches.map(async match => {
    const count = counts.find(row => row.match_id === match.id);
    const team = groups.find(group => group.id === match.group_id)?.name || 'Övrigt';
    const evaluationOpen = matchEvaluationIsOpen(match.date, match.start_time);
    const canEvaluate = user.permissions.includes('manage_evaluations');
    const evaluation = canEvaluate && team === 'Gul' && evaluationOpen ? await getMatchEvaluationStatus(match.id) : { total: 0, evaluated: 0 };
    return workflowMatch({ match, today, team, planSaved: !!readMatchPlan(plans.find(p => p.key === `match_plan:${match.id}`)?.value || ''),
      selected: count?.selected || 0, accepted: count?.accepted || 0, evaluation, evaluationOpen,
      canSelect: user.permissions.includes('manage_squads'), canEvaluate, canPlayers: user.permissions.includes('view_players') });
  }));
  return { status: 200, body: { today, matches: result, training, canTrain: user.permissions.includes('manage_evaluations'), canPlayers: user.permissions.includes('view_players') } };
}
