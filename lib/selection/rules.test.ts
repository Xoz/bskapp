import {describe,it,expect} from 'vitest';
import {allowedDoublePairs,toggleDoublePair,readPolicy,emptyPolicy,trainingPriority,historySummary,assessSelection,timeCompatible,validatePolicy,selectionSpace,type Evidence,type MatchEvidence} from './rules';
import {recommendYellowSelection,type RecommendationCandidate} from '../selectionSupport';
import type {SpaceInput} from '../matchSpace';
const match=(id:number,more:Partial<MatchEvidence>={}):MatchEvidence=>({id,date:'2026-09-10',time:'17:30',location:'Exempelplan',duration:60,level:3,played:false,reply:null,selected:false,...more});
const evidence=(more:Partial<Evidence>={}):Evidence=>({asOf:'2026-09-11',revision:'',policy:emptyPolicy(),training:[],matches:[],target:match(1,{date:'2026-09-18'}),...more});
const targetStart=Date.parse('2026-09-18T15:30Z');
const space=(more:Partial<SpaceInput>={}):SpaceInput=>({capacity:100,now:Date.parse('2026-09-11T09:00Z'),events:[],target:{id:'match:1',title:'Exempelmatch',start:targetStart,duration:60,minutes:45,kind:'match',planned:true,estimated:true},...more});
const t=(statuses:('present'|'absent'|'unknown')[])=>statuses.map((status,i)=>({id:String(i),date:'2026-09-09',status}));
describe('ordinarie närvaro',()=>{
 it('ger bonus 3–4, neutralt 2 och lägre prioritet 0–1 med komplett underlag',()=>{
  expect(trainingPriority(t(['present','present','present','absent']),emptyPolicy()).rank).toBe(0);
  expect(trainingPriority(t(['present','present','absent','absent']),emptyPolicy()).rank).toBe(1);
  expect(trainingPriority(t(['present','absent','absent','absent']),emptyPolicy()).rank).toBe(2);
 });
 it('okända, saknade eller giltigt undantagna pass bestraffas inte',()=>{
  expect(trainingPriority(t(['present','absent','unknown','absent']),emptyPolicy()).rank).toBe(1);
  expect(trainingPriority(t(['absent']),emptyPolicy()).rank).toBe(1);
  expect(trainingPriority(t(['present','absent','absent','absent']),{...emptyPolicy(),excusedTraining:['1']}).rank).toBe(1);
 });
});
describe('erbjudna matcher',()=>{
 it('skiljer nej från uteblivet erbjudande och räknar deltagande en gång',()=>{
  const h=historySummary(evidence({matches:[match(2,{played:true,reply:'accepted'}),match(3,{date:'2026-09-09',reply:'declined'}),match(4,{reply:'pending'})]}));
  expect(h).toMatchObject({played:1,offered:3,declined:1,pending:1,opportunities:2});
 });
 it('undantag och faktiska tidskrockar ger ingen extra erbjuden möjlighet',()=>{
  const e=evidence({matches:[match(2,{reply:'declined'}),match(3,{reply:'accepted'})]});
  expect(historySummary(e).opportunities).toBe(1);
  expect(historySummary({...e,matches:[match(2,{reply:'declined'})],policy:{...emptyPolicy(),excusedMatches:[2]}}).opportunities).toBe(0);
 });
 it('framtida planer är separata och målmatchen räknas inte dubbelt',()=>{
  expect(historySummary(evidence({matches:[match(1,{date:'2026-09-18',selected:true}),match(2,{date:'2026-09-19',reply:'pending'}),match(3,{date:'2026-09-20',reply:'declined',selected:true})]}))).toMatchObject({opportunities:0,planned:1});
 });
});
describe('dubbelmatch',()=>{
 const other=match(2,{date:'2026-09-18',time:'18:45',reply:'accepted',level:2});
 const second={id:'match:2',title:'Exempel andra',start:targetStart+75*60000,duration:60,minutes:45,kind:'match' as const,planned:true,estimated:true};
 it('kräver specifik nivåkombination och 50 procent för automatval',()=>{
  const e=evidence({matches:[other]});
  expect(assessSelection(e,space({events:[second]})).automatic).toBe(false);
  e.policy.pairs=['2+3'];
  expect(assessSelection(e,space({events:[second]})).automatic).toBe(false);
  // Gränskontroll med kvarvarande belastning från tidigare aktiviteter.
  const previous={...second,id:'training:heavy',kind:'training' as const,start:targetStart-40*60000,duration:40,minutes:40};
  const loaded=space({events:[previous,{...second,minutes:30}]});loaded.target!.minutes=30;
  expect(assessSelection(e,loaded).blocks).toContain('Dubbelmatch 40–49 % – kräver aktivt tränarval');
  const s=space({events:[{...second,minutes:30}]});s.target!.minutes=30;
  expect(assessSelection(e,s).automatic).toBe(true);
 });
 it('bedömer hela dagen även när målmatchen är sist och normaliserar individuell kapacitet',()=>{
  const e=evidence({target:other,matches:[match(1,{date:'2026-09-18',reply:'accepted'})],policy:{...emptyPolicy(),pairs:['2+3']}});
  const s=space({capacity:80,events:[space().target!],target:second});
  expect(assessSelection(e,s).automatic).toBe(false);
 });
 it('tredje match eller okända tider godtas inte automatiskt',()=>{
  expect(assessSelection(evidence({matches:[other,match(3,{date:other.date,reply:'pending'})]}),space()).blocks).toContain('Högst två matcher samma dag');
  expect(timeCompatible({...other,time:null},other)).toBeNull();
  expect(timeCompatible(match(1,{date:other.date}),other)).toBe(true);
  expect(timeCompatible(match(1,{date:other.date}),{...other,location:'Annan plan'})).toBe(false);
 });
 it('nej tar bort ett planerat åtagande, och känd otillgänglighet stoppar förslag',()=>{
  expect(assessSelection(evidence({matches:[{...other,reply:'declined',selected:true}]}),space()).double).toBe(false);
  expect(assessSelection(evidence({policy:{...emptyPolicy(),unavailableFrom:'2026-09-18',unavailableTo:'2026-09-19'}}),space()).automatic).toBe(false);
 });
 it('mindre lag ger mer speltid och ändrar prognosen',()=>{
  expect(selectionSpace(space(),1,'Back',9).target!.minutes).toBe(45);
  expect(selectionSpace(space(),1,'Back',7).target!.minutes).toBe(60);
  expect(selectionSpace(space(),1,'Målvakt',9).target!.minutes).toBe(60);
 });
});
describe('urval',()=>{
 const c=(id:number,e:Evidence):RecommendationCandidate=>({id,name:`Exempel ${id}`,teamNames:['Gul'],primaryTeamName:'Gul',windowMatchCount:0,recentMatchCount:0,upcomingMatchCount:0,lastSelectedDate:null,primaryLevel:'3',secondaryLevel:'2',selectionEligible:true,currentlySelected:false,currentCallupStatus:null,selectionEvidence:e,matchSpace:space(),position:'Back',spaceLevel:'normal'});
 it('upprepade nej ger inte ständig förtur',()=>{
  const a=c(1,evidence({matches:[match(3,{reply:'declined'}),match(4,{date:'2026-09-09',reply:'declined'})]}));
  const b=c(2,evidence({matches:[match(5,{played:true,reply:'accepted'})]}));
  expect(recommendYellowSelection({matchLevel:3,targetSize:1,candidates:[a,b]}).selectedIds).toEqual([2]);
 });
 it('bevarar ja och manuella val även när senare underlag varnar',()=>{
  const a=c(1,evidence({policy:{...emptyPolicy(),unavailableFrom:'2026-09-18',unavailableTo:'2026-09-18'}}));a.currentCallupStatus='accepted';
  const b=c(2,evidence());b.currentlySelected=true;
  expect(recommendYellowSelection({matchLevel:3,targetSize:1,candidates:[a,b]}).selectedIds).toEqual([1,2]);
 });
});
it('validerar inställningar och kalenderdatum',()=>{
 expect(()=>validatePolicy({...emptyPolicy(),pairs:['3+2']})).toThrow();
 expect(()=>validatePolicy({...emptyPolicy(),unavailableFrom:'2026-02-30',unavailableTo:'2026-03-02'})).toThrow();
});

 describe('nivåkombinationer omfattar lättare matcher',()=>{
  it('Svår + Svår omfattar alla sex, även från äldre sparad policy',()=>{
   expect(allowedDoublePairs(['2+2'])).toEqual(['2+2','2+3','2+4','3+3','3+4','4+4']);
   expect(readPolicy(JSON.stringify({...emptyPolicy(),pairs:['2+2']})).pairs).toHaveLength(6);
  });
  it('jämför båda matcherna och höjer aldrig en godkänd nivå',()=>{
   expect(allowedDoublePairs(['2+3'])).toEqual(['2+3','2+4','3+3','3+4','4+4']);
   expect(allowedDoublePairs(['2+4'])).toEqual(['2+4','3+4','4+4']);
   expect(allowedDoublePairs(['3+3'])).toEqual(['3+3','3+4','4+4']);
   expect(allowedDoublePairs(['4+4'])).toEqual(['4+4']);
   expect(allowedDoublePairs([])).toEqual([]);
  });
  it('markering fyller lättare rutor, avmarkering tar bort beroende godkännanden',()=>{
   const all=toggleDoublePair([],'2+2',true);
   expect(all).toHaveLength(6);
   expect(toggleDoublePair(all,'3+3',false)).toEqual(['2+4','3+4','4+4']);
   expect(toggleDoublePair(all,'4+4',false)).toEqual([]);
  });
  it('automatförslaget använder även ett högre godkännande direkt',()=>{
   const e=evidence({policy:{...emptyPolicy(),pairs:['2+2']},matches:[match(2,{date:'2026-09-18',time:'18:45',reply:'accepted',level:2})]});
   expect(assessSelection(e,space()).blocks).not.toContain('Nivåkombinationen kräver tränarbedömning');
  });
 });
