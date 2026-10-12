import { getCurrentUser, isStaffRole } from '../auth';
import { all } from '../db';
import { getPlayers } from '../queries';
import { validPlan, type TrainingPlan } from '../training/model';
import { swedishToday } from '../dates';

export async function desktopPractice() {
  const user = await getCurrentUser();
  if (!user) return { status: 401, body: { error: 'Logga in.' } };
  const canTrain = user.permissions.includes('manage_evaluations');
  const canPlayers = user.permissions.includes('view_players');
  if (!isStaffRole(user.primaryRole) || (!canTrain && !canPlayers))
    return { status: 403, body: { error: 'Behörighet saknas.' } };
  const canPrivate = canPlayers && user.permissions.includes('view_private_player_data');
  const plans = canTrain ? await all<{ id: string; document: TrainingPlan }>(
    'SELECT id,document FROM training_plans WHERE created_by=? ORDER BY updated_at DESC LIMIT 100', [user.id]) : [];
  const scoped = canPlayers ? await getPlayers() : [];
  const ids = scoped.map(p => p.id);
  const facts = canPrivate && ids.length ? await all<{ id: number; checkpoint: string | null; conversation: string | null; followup: string | null }>(
    `SELECT p.id,
      (SELECT date FROM development_checkpoints WHERE player_id=p.id ORDER BY date DESC,created_at DESC LIMIT 1) AS checkpoint,
      (SELECT conversation_date FROM player_conversations WHERE player_id=p.id ORDER BY conversation_date DESC,created_at DESC LIMIT 1) AS conversation,
      (SELECT follow_up_on FROM player_conversations WHERE player_id=p.id ORDER BY conversation_date DESC,created_at DESC LIMIT 1) AS followup
     FROM players p WHERE p.id IN (${ids.map(() => '?').join(',')})`, ids) : [];
  return { status: 200, body: {
    today: swedishToday(), canTrain, canPlayers, canEdit: canPrivate && canTrain, canPrivate,
    plans: plans.filter(p => validPlan(p.document)).map(p => ({ id: p.id, title: p.document.title, date: p.document.date,
      blocks: p.document.blocks.map(b => ({ id: b.id, minutes: b.minutes, title: b.diagram.title, notes: b.diagram.notes })) })),
    players: scoped.map(p => { const f = facts.find(f => f.id === p.id); return { id: p.id, name: p.name,
      checkpoint: f?.checkpoint ?? null, conversation: f?.conversation ?? null, followup: f?.followup ?? null }; }),
  } };
}
