import { createHash } from 'node:crypto';
import { getCurrentUser, isStaffRole, canAccessPlayer, canAccessGroup } from '../auth';
import { all, get, run, batch, transaction, logActivity } from '../db';
import { getPlayers, getDevelopmentCheckpoints, getPlayerConversations, getPlayer } from '../queries';
import { getMobilePlayer, getMobilePlayerDevelopment } from '../services/development';
import { getMobileMatchEvaluation, saveMobileMatchEvaluation, type MobileMatchEvaluationAnswer, type MobileMatchEvaluationContext } from '../services/matchEvaluationMobile';
import { matchEvaluationIsOpen } from '../matchEvaluation';
import { emptyMatchPlan, readMatchPlan, MATCH_FORMATIONS, IDEA_FIELDS } from '../matchPlan/model';
import { saveMatchPlan } from '../matchPlan/actions';
import { selectionDraftStatements, type DraftPlayer } from '../selectionDraft';
import { checkSelectionDraft } from '../selection/save';
import { swedishToday } from '../dates';
import { revalidatePath } from 'next/cache';

const response = (status: number, body: object) => ({ status, body });
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const uuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export async function readWorkday(kind: string, id: number) {
 const user = await getCurrentUser();
 if (!user || !isStaffRole(user.primaryRole)) return response(403,{error:'Logga in med rätt behörighet.'});
 if (kind==='session') return response(200,{scope:`user-${user.id}`});
 if (!Number.isSafeInteger(id) || id < 1) return response(400,{error:'Ogiltigt id.'});
 if (kind === 'player') {
  if (!user.permissions.includes('view_players') || !user.permissions.includes('view_private_player_data') || !await canAccessPlayer(id)) return response(403,{error:'Du saknar åtkomst till spelarprofilen.'});
  if (!(await getPlayer(id))?.active) return response(404,{error:'Spelaren är inte tillgänglig.'});
  const [profile,development,checkpoints,conversations] = await Promise.all([getMobilePlayer(user,id),getMobilePlayerDevelopment(user,id),getDevelopmentCheckpoints(id),getPlayerConversations(id)]);
  return response(200,{scope:`user-${user.id}`,fetchedAt:new Date().toISOString(),profile,development,checkpoints,conversations,canEdit:user.permissions.includes('manage_evaluations')});
 }
 if (kind !== 'match') return response(400,{error:'Ogiltig arbetsyta.'});
 if (!user.permissions.includes('view_matches')) return response(403,{error:'Behörighet saknas.'});
 const match = await get<{id:number;opponent:string;date:string;start_time:string|null;home_away:string;group_id:number|null;location:string;finished:number;cancelled:number;level:string;formation:string;our_score:number|null;opponent_score:number|null}>('SELECT id,opponent,date,start_time,home_away,group_id,location,finished,cancelled,level,formation,our_score,opponent_score FROM matches WHERE id=?',[id]);
 if (!match || !await canAccessGroup(match.group_id)) return response(404,{error:'Matchen är inte tillgänglig.'});
 const canSelect=user.permissions.includes('manage_squads') && !match.cancelled && !match.finished && match.date>=swedishToday();
 const canEvaluate=user.permissions.includes('manage_evaluations') && !match.cancelled && matchEvaluationIsOpen(match.date,match.start_time);
 const canPlan=user.permissions.includes('manage_squads') && !match.cancelled;
 const [players,roster,planRow,evaluation] = await Promise.all([
  user.permissions.includes('view_players') ? getPlayers() : Promise.resolve([]),
  all<{player_id:number;name:string;selected_position:string;selection_status:string|null;callup_status:string|null;updated_at:string}>('SELECT mr.player_id,p.name,mr.selected_position,mr.selection_status,mr.callup_status,mr.updated_at::text FROM match_roster mr JOIN players p ON p.id=mr.player_id WHERE mr.match_id=? ORDER BY mr.player_id',[id]),
  get<{value:string}>('SELECT value FROM settings WHERE key=?',[`match_plan:${id}`]),
  canEvaluate ? getMobileMatchEvaluation(user,id) : Promise.resolve(null),
 ]);
 const saved=readMatchPlan(planRow?.value || '');
 const plan=saved || {revision:0,document:emptyMatchPlan(match.formation)};
 const candidates=players.map(p=>({id:p.id,name:p.name,position:p.preferred_position_primary || p.position || '',selected:roster.some(r=>r.player_id===p.id&&r.selection_status==='selected'),reply:roster.find(r=>r.player_id===p.id)?.callup_status || ''}));
 // Version includes fresh replies/selection/participants and actor-specific evaluation.
 const version=digest({match,roster,plan,evaluation});
 const state={id:match.id,date:match.date,finished:match.finished,cancelled:match.cancelled,group:match.group_id};
 const versions={selection:digest({state,roster,candidates}),plan:digest({state,plan,accepted:roster.filter(r=>r.callup_status==='accepted').map(r=>r.player_id)}),evaluation:digest({state,evaluation})};
 return response(200,{scope:`user-${user.id}`,fetchedAt:new Date().toISOString(),version,versions,match,candidates,roster,plan,evaluation,formations:MATCH_FORMATIONS,ideaFields:IDEA_FIELDS,canSelect,canPlan,canEvaluate});
}
export async function writeWorkday(raw: unknown) {
 if (!raw || typeof raw!=='object' || Array.isArray(raw)) return response(400,{error:'Ogiltigt underlag.'});
 const body=raw as Record<string,unknown>;
 const user=await getCurrentUser();
 if (!user || !isStaffRole(user.primaryRole)) return response(403,{error:'Logga in med rätt behörighet.'});
 if (!['selection','plan','evaluation'].includes(String(body.kind)) || !Number.isSafeInteger(body.matchId) || Number(body.matchId)<1 || !uuid(body.commandId) || typeof body.version!=='string') return response(400,{error:'Ogiltigt sparförsök.'});
 const id=Number(body.matchId);
 try {
  return await transaction(async()=>{
   await run('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
   // Same advisory lock as existing selection/sync; never lock after row lock.
   await run('SELECT pg_advisory_xact_lock(2014, ?)',[id]);
   await run('SELECT id FROM matches WHERE id=? FOR UPDATE',[id]);
   const fresh=await readWorkday('match',id);
   if (fresh.status!==200) return fresh;
   const w=fresh.body as {version:string;versions:Record<string,string>;canSelect:boolean;canPlan:boolean;canEvaluate:boolean;candidates:{id:number}[]};
   const permission=body.kind==='selection'?w.canSelect:body.kind==='plan'?w.canPlan:w.canEvaluate;
   const key=`desktop_command:${user.id}:${body.commandId}`;
   const prior=await get<{value:string}>('SELECT value FROM settings WHERE key=?',[key]);
   const hash=digest(body);
   if(prior){const receipt=JSON.parse(prior.value);return receipt.hash===hash?response(200,{saved:true}):response(409,{error:'Sparförsöket används redan för annat innehåll.'});}
   if (!permission) return response(403,{error:'Du kan inte ändra detta matchsteg.'});
   if(w.versions[String(body.kind)]!==body.version)return response(409,{error:'Matchunderlaget har ändrats. Ditt lokala utkast finns kvar. Jämför med den senaste versionen innan du fortsätter.'});
   if(body.kind==='selection'){
    if(!Array.isArray(body.players)||body.players.length>100)return response(400,{error:'Ogiltig laguppställning.'});
    const selected=body.players as DraftPlayer[];
    const allowed=new Set(w.candidates.map(p=>p.id));
    if(selected.some(p=>!p||!allowed.has(p.playerId)||typeof p.position!=='string'||p.position.length>40)||new Set(selected.map(p=>p.playerId)).size!==selected.length)return response(400,{error:'Kontrollera spelarval och positioner.'});
    await checkSelectionDraft(id,selected.map(p=>({id:p.playerId,position:p.position})),body.acknowledged===true);
    await batch(selectionDraftStatements(id,selected));
    await logActivity(user.name,'sparade Mac-laguppställning',`${selected.length} uttagna`);
   } else if(body.kind==='plan'){
    const result=await saveMatchPlan(id,Number(body.revision),body.document);
    if(result.error)return response(409,{error:result.error});
   } else {
    if(!Array.isArray(body.answers)||body.answers.length>100||!body.context||typeof body.context!=='object')return response(400,{error:'Ogiltig utvärdering.'});
    const answers=body.answers as MobileMatchEvaluationAnswer[];
    const context=body.context as MobileMatchEvaluationContext;
    if(typeof context.coachComment!=='string'||answers.some(a=>!a||!Number.isSafeInteger(a.playerId)||typeof a.ratingComment!=='string'||!(a.rating===null||Number.isInteger(a.rating))))return response(400,{error:'Kontrollera utvärderingsfälten.'});
    await saveMobileMatchEvaluation(user,id,answers,context);
   }
   await run('INSERT INTO settings(key,value) VALUES(?,?)',[key,JSON.stringify({hash,at:new Date().toISOString()})]);
   for(const path of [`/matcher/${id}`,`/matcher/${id}/laguttagning`,`/matcher/${id}/utvardera`,'/idag'])revalidatePath(path);
   return response(200,{saved:true});
  });
 }catch(e){
  const code=(e as {code?:string}).code;
  const status=(e as {status?:number}).status;
  if(e instanceof Error && status && status>=400 && status<500 && ['unauthorized','forbidden','not_found','invalid','idempotency_conflict'].includes(code || ''))return response(status,{error:e.message});
  if(code==='40001'||code==='23505')return response(409,{error:'Underlaget ändrades samtidigt. Kontrollera senaste versionen och försök igen.'});
  if(e instanceof Error && !code)return response(400,{error:e.message});
  throw e;
 }
}
