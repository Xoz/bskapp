import {it,expect,vi,beforeEach} from 'vitest';
vi.mock('./data',()=>({getSelectionEvidence:vi.fn()}));
vi.mock('../matchSpaceData',()=>({getMatchSpaceInputs:vi.fn()}));
vi.mock('../db',()=>({all:vi.fn()}));
import {checkSelectionDraft} from './save';
import {getSelectionEvidence} from './data';
import {getMatchSpaceInputs} from '../matchSpaceData';
import {all} from '../db';
import {emptyPolicy,type Evidence} from './rules';
import type {SpaceInput} from '../matchSpace';
const start=Date.parse('2026-09-18T15:30Z');
const e:Evidence={asOf:'2026-09-11',revision:'',policy:{...emptyPolicy(),pairs:['2+3']},training:[],target:{id:1,date:'2026-09-18',time:'17:30',duration:60,location:'Exempelplan',level:3},matches:[{id:2,date:'2026-09-18',time:'18:45',duration:60,location:'Exempelplan',level:2,reply:'accepted',selected:false,played:false}]};
const space:SpaceInput={now:start-7*86400000,capacity:100,target:{id:'match:1',title:'Exempel',start,duration:60,minutes:45,kind:'match',planned:true,estimated:true},events:[{id:'match:2',title:'Exempel',start:start+75*60000,duration:60,minutes:45,kind:'match',planned:true,estimated:true}]};
beforeEach(()=>{vi.mocked(getSelectionEvidence).mockResolvedValue(new Map([[1,structuredClone(e)]]));vi.mocked(getMatchSpaceInputs).mockResolvedValue(new Map([[1,structuredClone(space)]]));vi.mocked(all).mockResolvedValue([]);});
it('kräver tränarval även för en enkelmatch under 50 procent',async()=>{
 const single=structuredClone(e);single.matches=[];
 const loaded=structuredClone(space);loaded.events=[{...loaded.events[0],id:'training:prior',kind:'training',start:start-40*60000,duration:40,minutes:40}];
 vi.mocked(getSelectionEvidence).mockResolvedValue(new Map([[1,single]]));
 vi.mocked(getMatchSpaceInputs).mockResolvedValue(new Map([[1,loaded]]));
 await expect(checkSelectionDraft(1,[{id:1,position:'Back'}],false)).rejects.toThrow('tränarbedömning');
 await expect(checkSelectionDraft(1,[{id:1,position:'Back'}],true)).resolves.toBeUndefined();
});
it('nekar en tredje match även med aktivt tränarval',async()=>{
 const third=structuredClone(e);third.matches.push({...third.matches[0],id:3,time:'20:00'});vi.mocked(getSelectionEvidence).mockResolvedValue(new Map([[1,third]]));
 await expect(checkSelectionDraft(1,[{id:1,position:'Back'}],true)).rejects.toThrow('fler än två');
});
it('bevarar befintlig uttagning när nytt underlag varnar',async()=>{
 vi.mocked(all).mockResolvedValue([{player_id:1}]);
 await expect(checkSelectionDraft(1,[{id:1,position:'Målvakt'}],false)).resolves.toBeUndefined();
});

it('sparar en match över 50 procent utan extra batterigodkännande',async()=>{
 const single=structuredClone(e);single.matches=[];
 vi.mocked(getSelectionEvidence).mockResolvedValue(new Map([[1,single]]));
 vi.mocked(getMatchSpaceInputs).mockResolvedValue(new Map([[1,{...space,events:[]}]]));
 await expect(checkSelectionDraft(1,[{id:1,position:'Målvakt'}],false)).resolves.toBeUndefined();
});

it('lågt batteri i dubbelmatch kräver aktivt val men är ingen absolut spärr',async()=>{
 await expect(checkSelectionDraft(1,[{id:1,position:'Målvakt'}],false)).rejects.toThrow('tränarbedömning');
 await expect(checkSelectionDraft(1,[{id:1,position:'Målvakt'}],true)).resolves.toBeUndefined();
});
