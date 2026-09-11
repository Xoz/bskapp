import 'server-only';
import {all,get} from '../db';
import {canAccessPlayer,canAccessGroup,getCurrentUser} from '../auth';
import {loadSelectionEvidence} from './reader';
export async function getSelectionEvidence(ids:number[],targetMatchId?:number) {
 const actor=await getCurrentUser();
 if(!actor?.permissions.includes('manage_squads'))throw Error('Behörighet saknas.');
 if(ids.some(id=>!Number.isInteger(id)||id<1)||(await Promise.all(ids.map(canAccessPlayer))).some(ok=>!ok))throw Error('Spelaråtkomst saknas.');
 if(targetMatchId){const match=await get<{group_id:number|null}>('SELECT group_id FROM matches WHERE id=?',[targetMatchId]);if(!match||!await canAccessGroup(match.group_id))throw Error('Matchåtkomst saknas.');}
 return loadSelectionEvidence(all,ids,targetMatchId);
}
