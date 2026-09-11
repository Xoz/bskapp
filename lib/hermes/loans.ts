import 'server-only';
import {loanAnswer} from './loanAnswer';
import {all,get} from '../db';
import {loadCurrentUserById,isStaffRole} from '../auth';
import {loadMatchSpaceInputs} from '../matchSpaceReader';
import {regularMatchSql} from '../regularMatches';
import {swedishDate} from '../dates';
import {loanCandidate,LOAN_MARGIN,type LoanMatch} from './loanModel';
export type LoanBinding={userId:number;sourceGroupId:number;targetGroupIds:number[]};
export async function readLoans(binding:LoanBinding,targetId?:number,now=Date.now()) {
  const actor=await loadCurrentUserById(binding.userId);
  if(!actor || !actor.roles.some(isStaffRole) || !['view_players','view_matches','view_statistics'].every(p=>actor.permissions.includes(p as never))) throw new Error('Åtkomst nekad');
  const stored=await get<{user_id:number;group_id:number}>('SELECT user_id,group_id FROM bsk_hermes.binding WHERE singleton=true');
  if(stored?.user_id!==binding.userId||stored.group_id!==binding.sourceGroupId) throw new Error('Åtkomst nekad');
  const canAccessGroup=async(id:number|null)=>{
    if(id==null) return false;
    const group=await get<{parent_id:number|null}>('SELECT parent_id FROM groups WHERE id=? AND active=1',[id]);
    return !!group && (actor.roles.includes('admin')||!actor.groupIds.length||actor.groupIds.includes(id)||actor.groupIds.includes(group.parent_id!));
  };
  if(!await canAccessGroup(binding.sourceGroupId)) throw new Error('Åtkomst nekad');
  const groups=[];
  for(const id of binding.targetGroupIds) if(await canAccessGroup(id)) groups.push(id);
  if(!groups.length) throw new Error('Åtkomst nekad');
  const today=swedishDate(new Date(now)),until=swedishDate(new Date(now+7*86400000));
  const targetMatches=await all<LoanMatch>(`SELECT m.id,m.date,m.start_time,m.opponent,m.location,m.group_id,g.name AS group_name,m.periods*m.period_minutes AS duration,true AS regular,NULL::text AS callup_status,NULL::text AS selection_status
    FROM matches m JOIN groups g ON g.id=m.group_id WHERE m.group_id IN (${groups.map(()=>'?').join(',')}) AND m.cancelled=0 AND m.finished=0 AND m.date BETWEEN ? AND ? AND ${regularMatchSql()} ORDER BY m.date,m.start_time,m.id`,[...groups,today,until]);
  const common={source:'BSK huvudapp',fetchedAt:new Date(now).toISOString(),fetchedAtSwedish:new Date(now).toLocaleString('sv-SE',{timeZone:'Europe/Stockholm'}),timeZone:'Europe/Stockholm',sourceGroupId:binding.sourceGroupId,period:{from:today,to:until},readOnly:true};
  if(targetId===undefined) return {...common,targetMatches};
  const target=targetMatches.find(m=>m.id===targetId);
  if(!target) throw new Error('Målmatchen är inte tillgänglig under kommande sju dagar');
  const players=await all<{id:number;name:string}>(`SELECT p.id,p.name FROM players p WHERE p.active=1 AND EXISTS (SELECT 1 FROM player_group_memberships pm WHERE pm.player_id=p.id AND pm.group_id=? AND (NULLIF(pm.starts_on,'') IS NULL OR pm.starts_on<=?) AND (NULLIF(pm.ends_on,'') IS NULL OR pm.ends_on>=?)) ORDER BY p.name`,[binding.sourceGroupId,target.date,target.date]);
  const inputs=await loadMatchSpaceInputs({all,get,canAccessGroup},players.map(p=>p.id),targetId,now);
  const rows=players.length?await all<LoanMatch & {player_id:number}>(`SELECT r.player_id,m.id,m.date,m.start_time,m.opponent,m.location,m.group_id,g.name AS group_name,m.periods*m.period_minutes AS duration,${regularMatchSql()} AS regular,r.callup_status,r.selection_status FROM matches m JOIN match_roster r ON r.match_id=m.id LEFT JOIN groups g ON g.id=m.group_id WHERE r.player_id IN (${players.map(()=>'?').join(',')}) AND m.cancelled=0 AND m.date BETWEEN ? AND ? ORDER BY m.date,m.start_time,m.id`,[...players.map(p=>p.id),swedishDate(new Date(now-86400000)),swedishDate(new Date(Date.parse(target.date+'T12:00:00Z')+7*86400000))]):[];
  const sync=await all<{key:string;value:string}>('SELECT key,value FROM settings WHERE key IN (?,?)',['svenskalag_sync_status','svenskalag_green_sync_status']);
  const coverage=sync.map(r=>{try{const v=JSON.parse(r.value);return {source:r.key,state:v.state,lastSuccess:v.lastSuccess,unmatchedCount:v.unmatched?.length??0};}catch{return {source:r.key,state:'unknown'};}});
  const incomplete=coverage.length<2||coverage.some(s=>s.state!=='ok'||s.unmatchedCount||!s.lastSuccess||!Number.isFinite(Date.parse(s.lastSuccess))||now-Date.parse(s.lastSuccess)>26*3600000);
  if(incomplete) for(const input of inputs.values()) input.sourceWarning=[input.sourceWarning,'Synkens täckning är inte fullständig eller aktuell; kontrollera innan lån.'].filter(Boolean).join(' ');
  const candidates=players.map(p=>({...p,...loanCandidate(inputs.get(p.id)!,rows.filter(r=>r.player_id===p.id),target)}));
  return {...common,target,coverage,assumedMargin:LOAN_MARGIN,
    answerText:loanAnswer(target,candidates,common.fetchedAtSwedish),
    categoryCounts:Object.fromEntries([...new Set(candidates.map(c=>c.category))].map(k=>[k,candidates.filter(c=>c.category===k).length])),
    instructions:'Commitments är kallelser/uttagningar, ALDRIG bevis att en match är spelad. Beskriv accepted som har tackat ja, särskilt isFuture=true. Ingen registrerad match betyder bara att ingen finns i underlaget. Tider anges i Europe/Stockholm; använd fetchedAtSwedish. Endast dessa spelare tillhör källaget. Ja till en annan match gäller även utan uttagningsmarkering. Inget kallelsesvar bevisar ledighet till en ny match. Samling, pauser och restid är uttryckliga planeringsantaganden, inte verifierade tider. Cuper räknas separat men kan blockera kalendern. Batteri är planeringsstöd, inte prestationsbetyg.',
    candidates};
}
