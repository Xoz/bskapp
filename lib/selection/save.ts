import {getSelectionEvidence} from './data';
import {getMatchSpaceInputs} from '../matchSpaceData';
import {assessSelection,selectionSpace} from './rules';
import {all} from '../db';

/** Kontrollerar nya val mot färska serveruppgifter. Ett ändrat underlag får
 * aldrig återkalla en befintlig uttagning eller skriva om ett kallelsesvar. */
export async function checkSelectionDraft(matchId:number,selected:{id:number;position:string}[],acknowledged:boolean) {
 if(!selected.length)return;
 const [evidence,spaces,existing]=await Promise.all([
  getSelectionEvidence(selected.map(p=>p.id),matchId),getMatchSpaceInputs(selected.map(p=>p.id),matchId),
  all<{player_id:number;callup_status?:string}>('SELECT player_id,callup_status FROM match_roster WHERE match_id=? AND (selection_status=\'selected\' OR callup_status=\'accepted\')',[matchId]),
 ]);
 const fixed=new Set(existing.map(p=>p.player_id));
 const playingIds=new Set([...existing.filter(p=>p.callup_status==='accepted').map(p=>p.player_id),...selected.filter(p=>evidence.get(p.id)?.matches.find(m=>m.id===matchId)?.reply!=='declined').map(p=>p.id)]);
 for(const p of selected){
  if(fixed.has(p.id))continue;
  const e=evidence.get(p.id)!,s=spaces.get(p.id)!;
  const a=assessSelection(e,selectionSpace(s,p.id,p.position,playingIds.size));
  if(a.blocks.includes('Högst två matcher samma dag'))throw Error('Ett nytt val ger fler än två matcher samma dag. Ändra planeringen först.');
  if(a.blocks.length&&!acknowledged)throw Error('Det finns nya val som kräver tränarbedömning. Granska varningarna och markera ditt aktiva val innan du sparar.');
 }
}
