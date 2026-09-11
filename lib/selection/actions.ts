'use server';
import {revalidatePath} from 'next/cache';
import {canAccessPlayer,getCurrentUser} from '../auth';
import {get,run} from '../db';
import {policyKey,validatePolicy} from './rules';

export async function saveSelectionPolicy(playerId:number,form:FormData):Promise<{ok:boolean;message:string;revision?:string}> {
 const actor=await getCurrentUser();
 if(!actor?.permissions.includes('manage_squads')||!Number.isInteger(playerId)||playerId<1||!await canAccessPlayer(playerId))throw Error('Behörighet saknas.');
 if(!await get('SELECT id FROM players WHERE id=? AND active=1',[playerId]))throw Error('Spelaren är inte aktiv.');
 let policy;
 try{policy=validatePolicy({pairs:form.getAll('pair').map(String),excusedTraining:form.getAll('excused_training').map(String),excusedMatches:form.getAll('excused_match').map(Number),unavailableFrom:String(form.get('unavailable_from')??''),unavailableTo:String(form.get('unavailable_to')??'')});}
 catch{return {ok:false,message:'Kontrollera nivåkombinationer och datum.'};}
 const expected=String(form.get('revision')??'');if(expected.length>30000)throw Error('Ogiltig version.');
 const value=JSON.stringify({...policy,updatedAt:new Date().toISOString(),updatedBy:actor.id});
 const rows=await run(`INSERT INTO settings(key,value) SELECT ?,? WHERE ?='' OR EXISTS(SELECT 1 FROM settings WHERE key=? AND value=?)
  ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE settings.value=? RETURNING key`,[policyKey(playerId),value,expected,policyKey(playerId),expected,expected]);
 if(!rows.length)return {ok:false,message:'Inställningarna har ändrats i en annan vy. Ladda om innan du sparar.'};
 revalidatePath(`/spelare/${playerId}`);revalidatePath('/matcher','layout');revalidatePath('/uttagning');
 return {ok:true,message:'Uttagningsreglerna är sparade.',revision:value};
}
