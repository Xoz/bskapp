import { createHash } from 'node:crypto';
import { getCurrentUser, canAccessPlayer, isStaffRole } from '../auth';
import { all, get, desktopTransaction, type SqlArgs } from '../db';
import { getPlayer, getLatestDevelopmentCheckpoint, getPlayerSkillStatuses } from '../queries';
import { BANK, validPlan } from '../training/model';
import { saveTrainingPlan } from '../training/actions';
import { saveTreeConversation } from '../treeConversationActions';
import { CATEGORIES, SKILLS, STATUS_ORDER, type SkillStatus } from '../skillTrappan';
import { prepareTreeConversation, realDate } from '../treeConversation';
import { swedishToday } from '../dates';
import { revalidatePath } from 'next/cache';

const uuid = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const reply = (status: number, body: object) => ({ status, body });
async function actor(playerId?: number) {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.primaryRole) || !user.permissions.includes('manage_evaluations')) return null;
  if (playerId !== undefined && (!Number.isSafeInteger(playerId) || playerId < 1 ||
    !user.permissions.includes('view_players') || !user.permissions.includes('view_private_player_data') || !(await canAccessPlayer(playerId)))) return null;
  return user;
}
type Query = <R>(sql: string, args?: SqlArgs) => Promise<R[]>;
type Row = { skill_id: string; status: SkillStatus; updated_at: string };
async function state(query: Query, id: number) {
  const rows = await query<Row>('SELECT skill_id,status,updated_at FROM player_skill_status WHERE player_id=? ORDER BY skill_id', [id]);
  const latest = await query<{ id: string }>('SELECT id FROM development_checkpoints WHERE player_id=? ORDER BY date DESC,created_at DESC LIMIT 1', [id]);
  const version = createHash('sha256').update(JSON.stringify([rows, latest[0]?.id || null])).digest('hex');
  return { rows, version };
}
export async function readDesktopEditor(kind: string, id: string) {
  if (!['training', 'checkpoint', 'conversation'].includes(kind)) return reply(400, { error: 'Ogiltig arbetsyta.' });
  const playerId = kind === 'training' ? undefined : Number(id);
  const user = await actor(playerId);
  if (!user) return reply(403, { error: 'Logga in med rätt behörighet.' });
  if (kind === 'training') {
    if (id !== 'nytt' && !uuid(id)) return reply(400, { error: 'Ogiltigt pass.' });
    const saved = id === 'nytt' ? null : await get<{ id: string; revision: number; document: unknown }>('SELECT id,revision,document FROM training_plans WHERE id=? AND created_by=?', [id, user.id]);
    if (id !== 'nytt' && (!saved || !validPlan(saved.document))) return reply(404, { error: 'Passet saknas eller är inte tillgängligt.' });
    return reply(200, { scope: `user-${user.id}`, id: saved?.id || crypto.randomUUID(), revision: saved?.revision || 0,
      document: saved?.document || { version: 1, title: 'Nytt träningspass', date: '', blocks: [] }, bank: BANK });
  }
  const player = await getPlayer(playerId!);
  if (!player?.active) return reply(404, { error: 'Spelaren är inte tillgänglig.' });
  // A serializable read gives the form one coherent basis and conflict token.
  const base = await desktopTransaction(async query => {
    const snapshot = await state(query, playerId!);
    return snapshot;
  });
  const [statuses, latest] = await Promise.all([getPlayerSkillStatuses(playerId!), getLatestDevelopmentCheckpoint(playerId!)]);
  // If a writer changed the basis while loading the remaining facts, reject rather than
  // presenting mismatched fields and a fresh token. The client can retry this read.
  if ((await state(all, playerId!)).version !== base.version) return reply(409, { error: 'Utvecklingsbilden ändrades. Hämta den igen.' });
  return reply(200, { scope: `user-${user.id}`, playerId, name: player.name, coach: user.name, today: swedishToday(), version: base.version,
    categories: CATEGORIES, skills: SKILLS, statuses, focus: latest?.skills.filter(s => s.is_focus).map(s => s.skill_id) || [],
    strengths: latest?.strengths || '', focusNote: latest?.focus_note || '', wellbeing: latest?.wellbeing_note || '',
    preparation: prepareTreeConversation(latest?.id || null, latest?.date || null, latest?.skills || []) });
}
export async function writeDesktopEditor(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, { error: 'Ogiltigt underlag.' });
  const b = body as Record<string, unknown>;
  if (!['training', 'checkpoint', 'conversation'].includes(String(b.kind))) return reply(400, { error: 'Ogiltig arbetsyta.' });
  const playerId = Number(b.playerId);
  const user = await actor(b.kind === 'training' ? undefined : playerId);
  if (!user) return reply(403, { error: 'Logga in med rätt behörighet.' });
  if (b.kind === 'training') {
    if (!uuid(b.id) || !Number.isSafeInteger(b.revision) || !validPlan(b.document)) return reply(400, { error: 'Kontrollera passets namn, datum, minuter och ritningar.' });
    const result = await saveTrainingPlan(b.id, b.revision as number, b.document);
    return reply(result.error ? 409 : 200, result);
  }
  if (!(await getPlayer(playerId))?.active) return reply(404, { error: 'Spelaren är inte tillgänglig.' });
  if (!uuid(b.commandId)) return reply(400, { error: 'Ogiltigt sparförsök.' });
  if (b.kind === 'conversation') {
    const form = new FormData();
    const fields = { command_id: b.commandId, checkpoint_id: b.checkpointId, conversation_date: b.date,
      outcome: b.outcome, note: b.note, player_perspective: b.perspective, agreed_actions: b.agreement, follow_up_on: b.followup };
    if (Object.values(fields).some(v => typeof v !== 'string')) return reply(400, { error: 'Kontrollera samtalsfältens format.' });
    for (const [key, value] of Object.entries(fields)) form.set(key, value as string);
    const result = await saveTreeConversation(playerId, form);
    return reply(result.error ? 400 : 200, result);
  }
  const textFields = ['date', 'coach', 'strengths', 'focusNote', 'wellbeing', 'version'];
  if (textFields.some(k => typeof b[k] !== 'string') || !realDate(b.date as string) ||
    (b.coach as string).length > 120 || ['strengths', 'focusNote', 'wellbeing'].some(k => (b[k] as string).length > 2000) ||
    !Array.isArray(b.focus) || b.focus.length > 2 || new Set(b.focus).size !== b.focus.length ||
    b.focus.some(id => !SKILLS.some(s => s.id === id)) || !b.statuses || typeof b.statuses !== 'object' || Array.isArray(b.statuses))
    return reply(400, { error: 'Kontrollera datum, noteringar och högst två fokus.' });
  const statuses = b.statuses as Record<string, SkillStatus>;
  if (Object.keys(statuses).length !== SKILLS.length || SKILLS.some(s => !STATUS_ORDER.includes(statuses[s.id])) || Object.keys(statuses).some(id => !SKILLS.some(s => s.id === id)))
    return reply(400, { error: 'Alla färdigheter måste ha en giltig status.' });
  const focus = b.focus as string[], coach = (b.coach as string).trim() || user.name;
  try {
    const result = await desktopTransaction(async query => {
      const lockedPlayer = await query<{ name: string }>('SELECT id,name FROM players WHERE id=? FOR UPDATE', [playerId]);
      const prior = await query<{ player_id: number; date: string; coach_name: string; strengths: string; focus_note: string; wellbeing_note: string }>('SELECT player_id,date,coach_name,strengths,focus_note,wellbeing_note FROM development_checkpoints WHERE id=?', [b.commandId as string]);
      if (prior[0]) {
        const saved = prior[0];
        const skills = await query<{ skill_id: string; status: string; is_focus: number }>('SELECT skill_id,status,is_focus FROM development_checkpoint_skills WHERE checkpoint_id=?', [b.commandId as string]);
        if (saved.player_id !== playerId || saved.date !== b.date || saved.coach_name !== coach || saved.strengths !== b.strengths || saved.focus_note !== b.focusNote || saved.wellbeing_note !== b.wellbeing || skills.length !== SKILLS.length || skills.some(s => s.status !== statuses[s.skill_id] || !!s.is_focus !== focus.includes(s.skill_id)))
          return reply(409, { error: 'Sparförsöket har redan använts för ett annat innehåll.' });
        return reply(200, { saved: true });
      }
      const current = await state(query, playerId);
      if (current.version !== b.version) return reply(409, { error: 'Utvecklingsbilden har ändrats. Ditt utkast finns kvar. Hämta senaste versionen innan du fortsätter.' });
      await query('INSERT INTO development_checkpoints (id,player_id,date,coach_name,strengths,focus_note,wellbeing_note) VALUES (?,?,?,?,?,?,?)',
        [b.commandId as string, playerId, b.date as string, coach, b.strengths as string, b.focusNote as string, b.wellbeing as string]);
      for (const skill of SKILLS) {
        await query('INSERT INTO development_checkpoint_skills (checkpoint_id,skill_id,status,previous_status,is_focus) VALUES (?,?,?,?,?)',
          [b.commandId as string, skill.id, statuses[skill.id], current.rows.find(r => r.skill_id === skill.id)?.status || 'not_started', focus.includes(skill.id) ? 1 : 0]);
        await query(`INSERT INTO player_skill_status (player_id,skill_id,status,updated_at) VALUES (?,?,?,to_char(now() AT TIME ZONE 'utc','YYYY-MM-DD HH24:MI:SS'))
          ON CONFLICT (player_id,skill_id) DO UPDATE SET status=EXCLUDED.status,updated_at=EXCLUDED.updated_at`, [playerId, skill.id, statuses[skill.id]]);
      }
      await query("INSERT INTO activity_log (coach_name,action,subject) VALUES (?,?,?)", [coach.slice(0, 60), 'Gjorde utvecklingsavstämning', (lockedPlayer[0]?.name || 'Spelare').slice(0, 100)]);
      return reply(200, { saved: true });
    });
    if (result.status === 200) for (const path of [`/spelare/${playerId}`, `/spelare/${playerId}/utveckling`, '/utveckling', '/mitt-utvecklingstrad']) revalidatePath(path);
    return result;
  } catch (error) {
    if ((error as { code?: string }).code === '40001' || (error as { code?: string }).code === '23505')
      return reply(409, { error: 'Ett annat sparande pågår. Försök igen med samma sparförsök.' });
    throw error;
  }
}
