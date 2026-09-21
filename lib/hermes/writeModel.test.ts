import {describe,it,expect} from 'vitest';
import {parseCommand,appendComment,revisionOf} from './writeModel';
const base={kind:'result',id:1,commandId:'c0b89074-e8d7-4b45-a61e-82853633e6f5',revision:'a'.repeat(64),ourScore:2,opponentScore:1};
describe('Hermes write commands',()=>{
 it('requires both valid score values',()=>{for(const value of [-1,100,1.5,'2',undefined])expect(()=>parseCommand({...base,ourScore:value})).toThrow();expect(parseCommand(base).ourScore).toBe(2);});
 it('requires an identified target and fresh revision',()=>{for(const patch of [{id:0},{id:1.2},{revision:''},{commandId:''},{kind:'send_callups'}])expect(()=>parseCommand({...base,...patch})).toThrow();});
 it('validates and canonicalizes selected players without sending invitations',()=>{const c=parseCommand({...base,kind:'selection',players:[{playerId:2,position:' '},{playerId:1,position:'GK'}]});expect(c.players?.[0].playerId).toBe(1);expect(c).not.toHaveProperty('ourScore');expect(()=>parseCommand({...base,kind:'selection',players:[{playerId:1,position:''},{playerId:1,position:''}]})).toThrow();});
 it('preserves earlier comments and rejects overflow instead of truncating',()=>{expect(appendComment('Tidigare','Ny text','Tränare',50)).toBe('Tidigare\n\nTränare: Ny text');expect(()=>appendComment('Tidigare','Ny text','Tränare',10)).toThrow();});
 it('rejects missing comment and changes revisions when state changes',()=>{expect(()=>parseCommand({...base,kind:'player_comment',text:' '})).toThrow();expect(revisionOf({score:1})).not.toBe(revisionOf({score:2}));});
});
