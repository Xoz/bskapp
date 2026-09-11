import { batteryPercent, forecastMatchSpace, type SpaceInput } from '../matchSpace';
import { swedishDate, swedishWallClockToEpoch } from '../dates';
import { sanktanLevelLabel } from '../sanktanLevel';

export const pairKey = (a: number, b: number) => [a, b].sort((x,y)=>x-y).join('+');
export const DOUBLE_PAIRS = [2,3,4].flatMap(a=>[2,3,4].filter(b=>b>=a).map(b=>({key:pairKey(a,b),label:`${sanktanLevelLabel(a)} + ${sanktanLevelLabel(b)}`})));
/** Lägre siffra är svårare. Jämför båda matcherna efter sortering. */
function coversPair(granted:string,requested:string) {
  const [a,b]=granted.split('+').map(Number),[x,y]=requested.split('+').map(Number);
  return a<=x && b<=y;
}
export function allowedDoublePairs(pairs:string[]):string[] {
  return DOUBLE_PAIRS.filter(pair=>pairs.some(grant=>DOUBLE_PAIRS.some(p=>p.key===grant)&&coversPair(grant,pair.key))).map(p=>p.key);
}
/** Avmarkering tar också bort svårare godkännanden som skulle återaktivera rutan. */
export function toggleDoublePair(pairs:string[],key:string,checked:boolean):string[] {
  if(!DOUBLE_PAIRS.some(p=>p.key===key))return allowedDoublePairs(pairs);
  return checked?allowedDoublePairs([...pairs,key]):allowedDoublePairs(pairs).filter(grant=>!coversPair(grant,key));
}
export type Policy = { pairs: string[]; excusedTraining: string[]; excusedMatches: number[]; unavailableFrom: string; unavailableTo: string };
export const emptyPolicy = (): Policy => ({pairs:[],excusedTraining:[],excusedMatches:[],unavailableFrom:'',unavailableTo:''});
export const policyKey = (id:number) => `selection_policy:${id}`;
export function validDate(s:string) {return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;}
export function validatePolicy(value: unknown): Policy {
  const p=value as Policy;
  if(!p || !Array.isArray(p.pairs)||p.pairs.length>6||p.pairs.some(s=>!DOUBLE_PAIRS.some(v=>v.key===s))
    ||!Array.isArray(p.excusedTraining)||p.excusedTraining.length>100||p.excusedTraining.some(s=>typeof s!=='string'||!s||s.length>150)
    ||!Array.isArray(p.excusedMatches)||p.excusedMatches.length>100||p.excusedMatches.some(id=>!Number.isInteger(id)||id<1)
    ||typeof p.unavailableFrom!=='string'||typeof p.unavailableTo!=='string'
    ||((p.unavailableFrom||p.unavailableTo)&&(!validDate(p.unavailableFrom)||!validDate(p.unavailableTo)||p.unavailableFrom>p.unavailableTo))) throw Error('Kontrollera nivåkombinationer och datum.');
  return {pairs:allowedDoublePairs(p.pairs),excusedTraining:[...new Set(p.excusedTraining)].sort(),excusedMatches:[...new Set(p.excusedMatches)].sort((a,b)=>a-b),unavailableFrom:p.unavailableFrom,unavailableTo:p.unavailableTo};
}
export function readPolicy(raw?:string):Policy {if(!raw)return emptyPolicy();return validatePolicy(JSON.parse(raw));}
export type Training = {id:string;date:string;status:'present'|'absent'|'unknown';excused?:boolean};
export type MatchEvidence = {id:number;date:string;time:string|null;duration:number;location:string;level:number|null;played:boolean;reply:'accepted'|'declined'|'pending'|null;selected:boolean;excused?:boolean};
export type Evidence = {asOf:string;policy:Policy;revision:string;training:Training[];matches:MatchEvidence[];target:{id:number;date:string;time:string|null;location:string;duration:number;level:number|null}|null};
export function unavailable(p:Policy,date:string) {return Boolean(p.unavailableFrom&&date>=p.unavailableFrom&&date<=p.unavailableTo);}
/** Okänt underlag får aldrig skapa en låg närvaroprioritet. Giltig frånvaro
 * neutraliserar en eventuell nackdel, men ger ingen närvarobonus. */
export function trainingPriority(training:Training[],policy:Policy) {
  const last=training.slice(0,4);const present=last.filter(t=>t.status==='present').length;
  const excused=last.filter(t=>t.status!=='present'&&(t.excused||policy.excusedTraining.includes(t.id)||unavailable(policy,t.date))).length;
  const unknown=last.filter(t=>t.status==='unknown'&&!t.excused&&!policy.excusedTraining.includes(t.id)&&!unavailable(policy,t.date)).length;
  const rank=present>=3?0:last.length===4&&present+unknown+excused<=1?2:1;
  return {present,unknown,excused,total:last.length,rank,label:`${present}/${last.length} bekräftade ordinarie träningar${unknown?` · ${unknown} okända`:''}${excused?` · ${excused} undantagna`:''}`};
}
/** För dubbelmatcher antas 15 min mellan matcher på samma plats (pauser/
 * övergång), 60 min på olika platser (pauser/samling/resa). Ej verifierad restid. */
export function timeCompatible(a:Evidence['target'],b:Evidence['target']) {
  if(!a||!b||!a.time||!b.time||!a.location.trim()||!b.location.trim())return null;
  const startA=swedishWallClockToEpoch(a.date,a.time),startB=swedishWallClockToEpoch(b.date,b.time);
  const [early,late,startEarly,startLate]=startA<=startB?[a,b,startA,startB]:[b,a,startB,startA];
  const same=early.location.trim().toLocaleLowerCase('sv')===late.location.trim().toLocaleLowerCase('sv');
  return startLate>=startEarly+(early.duration+(same?15:60))*60000;
}
export function historySummary(e:Evidence) {
  const past=e.matches.filter(m=>m.date<e.asOf);
  const isExcused=(m:MatchEvidence)=>m.excused||e.policy.excusedMatches.includes(m.id)||unavailable(e.policy,m.date)||past.some(other=>other.id!==m.id&&other.date===m.date&&(other.played||other.reply==='accepted')&&timeCompatible(m,other)===false);
  const declined=past.filter(m=>m.reply==='declined');
  // En match räknas en gång även om både erbjudande och deltagande finns.
  const opportunities=past.filter(m=>m.played||(!isExcused(m)&&(m.reply==='accepted'||m.reply==='declined'))).length;
  return {played:past.filter(m=>m.played).length,offered:past.filter(m=>m.reply!==null).length,declined:declined.length,excusedDeclines:declined.filter(isExcused).length,pending:past.filter(m=>m.reply==='pending').length,opportunities,
    planned:e.matches.filter(m=>m.id!==e.target?.id&&m.date>=e.asOf&&m.reply!=='declined'&&(m.selected||m.reply==='accepted'||m.reply==='pending')).length};
}
export function assessSelection(e:Evidence,space:SpaceInput,minutes?:number) {
  const reasons:string[]=[];const blocks:string[]=[];const cautions:string[]=[];
  const t=trainingPriority(e.training,e.policy),h=historySummary(e);
  reasons.push(t.label,`${h.offered} erbjudna · ${h.played} spelade · ${h.declined} nej · ${h.planned} planerade (fyra veckors historik)`);
  if(h.excusedDeclines)cautions.push(`${h.excusedDeclines} nej undantagna från rättvisejämförelsen`);
  if(h.pending)cautions.push(`${h.pending} äldre kallelser utan svar; räknas inte som nej`);
  if(t.rank===2)cautions.push('Lägre prioritet utifrån ordinarie träningsnärvaro');
  if(unavailable(e.policy,e.target?.date??''))blocks.push('Markerad som otillgänglig detta datum');
  if(!e.target?.time)blocks.push('Matchtid saknas – kontrollera tiderna');
  const sameDay=e.matches.filter(m=>m.id!==e.target?.id&&m.date===e.target?.date&&(m.played||m.reply!=='declined'&&(m.selected||m.reply==='accepted'||m.reply==='pending')));
  const forecast=forecastMatchSpace(space,minutes);
  if(forecast.level==='high')blocks.push('Prioritera vila eller lös aktivitetskrocken');
  if(sameDay.length>=2)blocks.push('Högst två matcher samma dag');
  if(sameDay.length===1){
    const other=sameDay[0],pair=e.target?.level&&other.level?pairKey(e.target.level,other.level):null;
    reasons.push(pair?`${sanktanLevelLabel(e.target!.level)} + ${sanktanLevelLabel(other.level)} samma dag`:'Dubbelmatch med okänd nivå');
    if(!pair||!allowedDoublePairs(e.policy.pairs).includes(pair))blocks.push('Nivåkombinationen kräver tränarbedömning');
    const timing=timeCompatible(e.target,other);
    if(timing!==true)blocks.push(timing===null?'Plats eller tid saknas för dubbelmatch':'För kort tid mellan matcherna');
    // Lägsta marginal från den första av dagens matcher, även om målmatchen är sist.
    const firstStart=Math.min(space.target!.start,swedishWallClockToEpoch(other.date,other.time||'12:00'));
    const target={...space.target!,minutes:minutes??space.target!.minutes};
    const events=[...space.events.filter(v=>v.id!==target.id),target];
    const first=events.filter(v=>v.kind==='match'&&swedishDate(new Date(v.start))===other.date).sort((a,b)=>a.start-b.start)[0];
    const combined=forecastMatchSpace({...space,now:firstStart,events,target:first});
    const rawPercent=combined.lowestRatio*100;
    reasons.push(`Lägsta batteriprognos med båda: ${batteryPercent(combined.lowest,combined.capacity)} %`);
    if(rawPercent<60)blocks.push(rawPercent<40?'Dubbelmatch under 40 % – prioritera vila':'Dubbelmatch 40–59 % – kräver aktivt tränarval');
    if(other.reply==='pending')cautions.push('Den andra matchens kallelse är obesvarad och räknas som möjlig belastning');
  }
  if(space.sourceWarning)cautions.push(space.sourceWarning);
  return {automatic:blocks.length===0,blocks,cautions,reasons,training:t,history:h,double:sameDay.length>0,forecast};
}

export function selectionSpace(space:SpaceInput,playerId:number,position:string,count:number,minutes?:number):SpaceInput {
 if(!space.target)return space;
 const keeper=/^(målvakt|malvakt|gk)$/i.test(position.trim());
 const duration=space.target.duration;
 const defaultMinutes=keeper?duration:Math.min(duration,(duration===75?8:6)*duration/Math.max(1,count-1));
 return {...space,target:{...space.target,minutes:Math.max(0,Math.min(duration,minutes??defaultMinutes))}};
}
