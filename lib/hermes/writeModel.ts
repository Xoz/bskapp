import {createHash} from 'node:crypto';
export type WriteKind='selection'|'match_comment'|'player_comment'|'result';
export type WriteCommand={kind:WriteKind;id:number;commandId:string;revision:string;text?:string;players?:{playerId:number;position?:string}[];ourScore?:number;opponentScore?:number};
export const revisionOf=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export class WriteError extends Error {constructor(message:string,public status=400){super(message);}}
export function parseCommand(raw:unknown):WriteCommand {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new WriteError('Ogiltigt kommando.');
  const c=raw as WriteCommand;
  if(!['selection','match_comment','player_comment','result'].includes(c.kind)||!Number.isSafeInteger(c.id)||c.id<1||c.id>2147483647)throw new WriteError('Ogiltig åtgärd eller identitet.');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c.commandId)||!/^[0-9a-f]{64}$/.test(c.revision))throw new WriteError('Hämta aktuellt skrivunderlag först.');
  const common={kind:c.kind,id:c.id,commandId:c.commandId,revision:c.revision};
  if(c.kind.endsWith('comment')){
    if(typeof c.text!=='string'||!c.text.trim()||c.text.length>1500)throw new WriteError('Kommentaren ska innehålla 1–1500 tecken.');
    return {...common,text:c.text.trim()};
  }
  if(c.kind==='result'){
    if([c.ourScore,c.opponentScore].some(x=>!Number.isInteger(x)||x!<0||x!>99))throw new WriteError('Ange båda lagens resultat, 0–99.');
    return {...common,ourScore:c.ourScore,opponentScore:c.opponentScore};
  }
  if(!Array.isArray(c.players)||c.players.length>50||new Set(c.players.map(p=>p?.playerId)).size!==c.players.length||c.players.some(p=>!p||!Number.isSafeInteger(p.playerId)||p.playerId<1||(p.position!==undefined&&(typeof p.position!=='string'||p.position.length>40))))throw new WriteError('Ogiltig laguttagning.');
  return {...common,players:c.players.map(p=>({playerId:p.playerId,...(p.position!==undefined?{position:p.position.trim()}:{})})).sort((a,b)=>a.playerId-b.playerId)};
}
export function appendComment(previous:string,text:string,signature:string,limit:number){
  const next=[previous.trim(),`${signature}: ${text.trim()}`].filter(Boolean).join('\n\n');
  if(next.length>limit)throw new WriteError('Anteckningsfältet är fullt. Befintlig text har inte ändrats.');
  return next;
}
