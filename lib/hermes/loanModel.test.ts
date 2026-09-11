import {describe,it,expect} from 'vitest';
import {loanCandidate,type LoanMatch} from './loanModel';
import {validLoanToken} from './loanAuth';
import type {SpaceInput} from '../matchSpace';
const now=Date.parse('2026-09-11T06:00:00Z');
const target:LoanMatch={id:171,date:'2026-09-12',start_time:'10:15',opponent:'Exempel',location:'B',group_id:6,group_name:'Grön',duration:60,regular:true,callup_status:null,selection_status:null};
const input:SpaceInput={now,capacity:100,events:[],target:{id:'match:171',title:'Exempel',start:Date.parse('2026-09-12T08:15:00Z'),duration:60,minutes:36,kind:'match',planned:true,estimated:true}};
describe('låneunderlag',()=>{
 it('ja utan selected blockerar AIK-liknande tidsmarginal',()=>{
 const r=loanCandidate(input,[{...target,id:7,start_time:'09:00',callup_status:'accepted'}],target);
 expect(r.category).toBe('upptagen_enligt_tidsantagande');expect(r.timing[0].gapMinutes).toBe(15);expect(r.regularMatchesOnTargetDay).toBe(2);
 });
 it('saknad kallelse bekräftar inte ledighet och målmatch räknas en gång',()=>{
 expect(loanCandidate(input,[],target).availabilityConfirmed).toBe(false);
 const r=loanCandidate(input,[{...target,callup_status:'accepted'},{...target,callup_status:'accepted'}],target);
 expect(r.category).toBe('redan_tackat_ja');expect(r.regularMatchesOnTargetDay).toBe(1);
 });
 it('fredagsmatcher påverkar lördag och procent gäller individuell kapacitet',()=>{
 const events=['16:45','18:00'].map((time,i)=>({...input.target!,id:`match:${i}`,start:Date.parse(`2026-09-11T${time}:00Z`),minutes:60}));
 const empty=loanCandidate(input,[],target),loaded=loanCandidate({...input,events},[],target);
 expect(loaded.battery.beforePercent).toBeLessThan(empty.battery.beforePercent);
 for(const capacity of [80,125]) expect(loanCandidate({...input,capacity},[],target).battery.nowPercent).toBe(100);
 });
 it('cup kan hindra kalendern utan att öka ordinarie matchantal',()=>{
 const r=loanCandidate(input,[{...target,id:8,regular:false,callup_status:'accepted'}],target);
 expect(r.category).toBe('upptagen_enligt_tidsantagande');expect(r.regularMatchesOnTargetDay).toBe(1);expect(r.cupCommitments).toHaveLength(1);
 });
 it('okänd tid och saknad synk gör inte en kandidat till säker',()=>{
 expect(loanCandidate({...input,sourceWarning:'Synk saknas'},[],target).category).toBe('underlag_behover_kontrolleras');
 expect(loanCandidate(input,[{...target,id:9,start_time:null,callup_status:'pending'}],target).category).toBe('kontrollera_annat_atagande');
 });
 it('nekad kallelse övertrumfar selected',()=>{
 expect(loanCandidate(input,[{...target,id:7,callup_status:'declined',selection_status:'selected'}],target).commitments).toHaveLength(0);
 });
 it('token kräver exakt giltig separat hemlighet',()=>{
 const secret='a'.repeat(64);expect(validLoanToken(`Bearer ${secret}`,secret)).toBe(true);
 for(const header of [null,'',`Bearer ${'b'.repeat(64)}`,`Bearer ${secret}x`]) expect(validLoanToken(header,secret)).toBe(false);
 expect(validLoanToken('Bearer short','short')).toBe(false);
 });
});
