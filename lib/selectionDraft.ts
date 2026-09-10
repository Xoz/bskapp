import type {SqlArgs} from './db';
import {draftKey} from './svenskalag/outbox';

export type DraftPlayer={playerId:number;position:string};
export function selectionDraftGuardStatements(matchId:number):{sql:string;args:(string|number|null)[]}[] {
  if(!Number.isInteger(matchId)||matchId<1) throw new Error('Ogiltig match');
  return [
    {sql:'SELECT pg_advisory_xact_lock(2014, ?)',args:[matchId]},
    {sql:"INSERT INTO settings(key,value) VALUES(?,'true') ON CONFLICT(key) DO UPDATE SET value='true'",args:[draftKey(matchId)]},
  ];
}
/** Gemensam för webb och mobil. Berör aldrig kallelsesvar eller faktisk närvaro. */
export function selectionDraftStatements(matchId:number,players:DraftPlayer[]):{sql:string;args:SqlArgs}[] {
  if(!Number.isInteger(matchId)||matchId<1||players.some(p=>!Number.isInteger(p.playerId)||p.playerId<1||typeof p.position!=='string'||p.position.length>40)||new Set(players.map(p=>p.playerId)).size!==players.length) throw new Error('Ogiltig laguppställning');
  return [
    ...selectionDraftGuardStatements(matchId),
    {sql:"UPDATE match_roster SET selection_status=NULL, selected_position='', updated_at=now() WHERE match_id=?",args:[matchId]},
    ...players.map(p=>({sql:`INSERT INTO match_roster(match_id,player_id,selection_status,selected_position,source)
      VALUES(?,?,'selected',?,'manual') ON CONFLICT(match_id,player_id) DO UPDATE SET
      selection_status='selected',selected_position=excluded.selected_position,source='manual',updated_at=now()`,args:[matchId,p.playerId,p.position]})),
  ];
}
