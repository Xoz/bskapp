import { batteryPercent, forecastMatchSpace, spaceLabels, type SpaceInput } from '../matchSpace';
import { swedishDate, swedishWallClockToEpoch } from '../dates';
export type LoanMatch = {id:number; date:string; start_time:string|null; opponent:string; location:string; group_id:number; group_name:string; duration:number; regular:boolean; callup_status:string|null; selection_status:string|null};
// Planeringsantaganden, aldrig uppmätt restid eller faktisk samling.
export const LOAN_MARGIN = {meetingMinutes:30, travelMinutes:30, breaksMinutes:10, totalMinutes:70};
export function loanCandidate(input:SpaceInput, matches:LoanMatch[], target:LoanMatch) {
  const forecast = forecastMatchSpace(input);
  const commitments = [...new Map(matches.filter(m=>m.id!==target.id && m.callup_status!=='declined' &&
    (m.callup_status==='accepted'||m.callup_status==='pending'||m.selection_status==='selected')).map(m=>[m.id,m])).values()];
  const targetStart=input.target!.start;
  const timing=commitments.filter(m=>m.date===target.date).map(m=>{
    if(!m.start_time || !target.start_time) return {matchId:m.id,status:'okand_tid',gapMinutes:null};
    const start=swedishWallClockToEpoch(m.date,m.start_time);
    const gap=start<targetStart?(targetStart-start)/60000-m.duration:(start-targetStart)/60000-target.duration;
    return {matchId:m.id,status:gap<0?'overlappar':gap<LOAN_MARGIN.totalMinutes?'otillracklig_antagen_marginal':'marginal_enligt_antagande',gapMinutes:gap};
  });
  const targetResponse=matches.find(m=>m.id===target.id)?.callup_status ?? null;
  const blocking=timing.filter(t=>t.status!=='marginal_enligt_antagande');
  const confirmedBlock=blocking.some(t=>commitments.find(m=>m.id===t.matchId)?.callup_status==='accepted');
  const category=targetResponse==='declined'?'tackat_nej_till_malmatch':targetResponse==='accepted'?'redan_tackat_ja':
    confirmedBlock?'upptagen_enligt_tidsantagande':blocking.length?'kontrollera_annat_atagande':
    forecast.level==='high'?'prioritera_vila':(input.sourceWarning||!target.start_time)?'underlag_behover_kontrolleras':'mojlig_att_fraga';
  return {category,availabilityConfirmed:false,targetResponse,
    battery:{nowPercent:batteryPercent(forecast.current,forecast.capacity),beforePercent:batteryPercent(forecast.before,forecast.capacity),afterPercent:batteryPercent(forecast.after,forecast.capacity),lowestPercent:batteryPercent(forecast.lowest,forecast.capacity),assessment:spaceLabels[forecast.level],estimated:true,targetMinutes:input.target!.minutes},
    warnings:[input.sourceWarning,...(!target.start_time?['Målmatchens tid saknas; batteriet använder 12:00.']:[])].filter(Boolean),
    commitments:commitments.map(m=>({...m,evidence:'Kallelse/uttagning; INTE registrerad närvaro',statusText:m.callup_status==='accepted'?'Har tackat ja – planerat deltagande':m.callup_status==='pending'?'Obesvarad kallelse':'Planerad uttagning utan bekräftat ja',isFuture:m.start_time?swedishWallClockToEpoch(m.date,m.start_time)>input.now:null})),timing,regularMatchesOnTargetDay:new Set([...commitments.filter(m=>m.date===target.date&&m.regular).map(m=>m.id),target.id]).size,
    cupCommitments:commitments.filter(m=>!m.regular),
    recentAndPlannedEvents:input.events.filter(e=>swedishDate(new Date(e.start))>=swedishDate(new Date(input.now-86400000))).map(e=>({id:e.id,title:e.title,start:new Date(e.start).toISOString(),minutes:e.minutes,planned:e.planned})),
  };
}
