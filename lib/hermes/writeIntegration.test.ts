import {beforeAll,describe,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
vi.mock('server-only',()=>({}));
const url=process.env.BSK_HERMES_WRITE_TEST_URL;
describe.skipIf(!url)('Hermes writes against isolated PostgreSQL',()=>{
 let db:typeof import('../db'),svc:typeof import('./writes');let binding:{userId:number;sourceGroupId:number;enabled:boolean};
 let player:number,otherPlayer:number,match:number,future:number,outside:number;
 beforeAll(async()=>{
  if(!/^postgres(?:ql)?:\/\/localhost(?::5432)?\/bsk_hermes_write_20260921$/.test(url!))throw new Error('Only isolated local database allowed');
  process.env.DATABASE_URL=url;db=await import('../db');svc=await import('./writes');await db.get('SELECT 1');
  const u=await db.get<{id:number}>('INSERT INTO users(email,name) VALUES(?,?) RETURNING id',[randomUUID()+'@example.invalid','Testtränare']);
  await db.run("INSERT INTO user_roles(user_id,role) VALUES(?,'coach')",[u!.id]);
  let g=await db.get<{id:number}>("SELECT id FROM groups WHERE name='Gul' AND group_type='subgroup' LIMIT 1");
  if(!g)g=await db.get<{id:number}>("INSERT INTO groups(name,group_type) VALUES('Gul','subgroup') RETURNING id");
  const other=await db.get<{id:number}>("INSERT INTO groups(name,group_type) VALUES(?,'subgroup') RETURNING id",['Other '+randomUUID()]);
  binding={userId:u!.id,sourceGroupId:g!.id,enabled:true};
  await db.run('INSERT INTO user_group_access(user_id,group_id) VALUES(?,?)',[u!.id,g!.id]);
  for(const [name,group] of [['Test Ada',g!.id],['Test Other',other!.id]] as const){
   const p=await db.get<{id:number}>('INSERT INTO players(name) VALUES(?) RETURNING id',[name]);
   await db.run('INSERT INTO player_group_memberships(player_id,group_id,is_primary) VALUES(?,?,1)',[p!.id,group]);
   if(group===g!.id)player=p!.id;else otherPlayer=p!.id;
  }
  await db.run('CREATE SCHEMA IF NOT EXISTS bsk_hermes');
  await db.run('CREATE TABLE IF NOT EXISTS bsk_hermes.binding(singleton boolean PRIMARY KEY DEFAULT true,user_id int,group_id int)');
  await db.run('INSERT INTO bsk_hermes.binding(user_id,group_id) VALUES(?,?) ON CONFLICT(singleton) DO UPDATE SET user_id=excluded.user_id,group_id=excluded.group_id',[u!.id,g!.id]);
  await db.run('CREATE OR REPLACE VIEW bsk_hermes.players AS SELECT p.id,p.name FROM players p JOIN player_group_memberships pm ON pm.player_id=p.id JOIN bsk_hermes.binding b ON b.group_id=pm.group_id WHERE p.active=1');
  for(const [days,group] of [[-1,g!.id],[1,g!.id],[-1,other!.id]]){
   const m=await db.get<{id:number}>("INSERT INTO matches(date,opponent,group_id,start_time,source) VALUES(to_char(now()+ (? || ' days')::interval,'YYYY-MM-DD'),?,?, '10:00','manual') RETURNING id",[String(days),'Test opponent',group]);
   if(group===other!.id)outside=m!.id;else if(days<0)match=m!.id;else future=m!.id;
   await db.run("INSERT INTO development_activities(id,activity_type,activity_date,title,group_id,match_id,external_source,external_key) VALUES(?,'match',to_char(now()+ (? || ' days')::interval,'YYYY-MM-DD'),'Test match',?,?,'manual_match',?)",[randomUUID(),String(days),group,m!.id,randomUUID()]);
  }
 },30000);
 const command=async(kind:import('./writeModel').WriteKind,id:number,values:object)=>({...await svc.writeContext(binding,kind,id),...values});
 it('appends player comment and repeated command does not duplicate',async()=>{
  const c=await command('player_comment',player,{text:'Bra passningar'});await svc.executeWrite(binding,c);const replay=await svc.executeWrite(binding,c);
  expect(replay.replayed).toBe(true);const n=await db.get<{note:string}>('SELECT note FROM player_skill_notes WHERE player_id=?',[player]);expect(n!.note.split('Bra passningar').length).toBe(2);
  await expect(svc.executeWrite(binding,{...c,text:'Annat innehåll'})).rejects.toThrow('annat innehåll');
 });
 it('preserves previous comment and rejects stale revisions',async()=>{
  const c=await command('player_comment',player,{text:'Ny kommentar'});await db.run("UPDATE player_skill_notes SET note=note || ' Manuellt' WHERE player_id=?",[player]);
  await expect(svc.executeWrite(binding,c)).rejects.toThrow('Underlaget har ändrats');
 });
 it('writes result and coach comment without changing each other',async()=>{
  await svc.executeWrite(binding,await command('result',match,{ourScore:3,opponentScore:2}));
  await svc.executeWrite(binding,await command('match_comment',match,{text:'Bra samspel'}));
  const row=await db.get<{our_score:number;evaluation_comment:string}>('SELECT our_score,evaluation_comment FROM matches WHERE id=?',[match]);expect(row!.our_score).toBe(3);expect(row!.evaluation_comment).toContain('Bra samspel');
 });
 it('protects live results and future results',async()=>{
  await db.run('UPDATE matches SET clock_offset=60 WHERE id=?',[match]);
  await expect(svc.executeWrite(binding,await command('result',match,{ourScore:9,opponentScore:2}))).rejects.toThrow('Matchcenter');
  await expect(svc.executeWrite(binding,await command('result',future,{ourScore:1,opponentScore:0}))).rejects.toThrow('inte klar');
 });
 it('saves selection without changing responses or sending to Svenska Lag',async()=>{
  await db.run("INSERT INTO match_roster(match_id,player_id,callup_status,selection_status) VALUES(?,?,'accepted',NULL)",[future,player]);
  await svc.executeWrite(binding,await command('selection',future,{players:[{playerId:player,position:''}]}));
  const row=await db.get<{selection_status:string;callup_status:string}>('SELECT selection_status,callup_status FROM match_roster WHERE match_id=? AND player_id=?',[future,player]);expect(row).toEqual({selection_status:'selected',callup_status:'accepted'});
  expect(await db.get("SELECT key FROM settings WHERE key=?",['svenskalag_outbox:'+future])).toBeUndefined();
 });
 it('denies other groups, players, disabled binding and revoked permissions',async()=>{
  await expect(svc.writeContext(binding,'result',outside)).rejects.toThrow('inte tillgänglig');
  await expect(svc.writeContext(binding,'player_comment',otherPlayer)).rejects.toThrow('inte tillgänglig');
  await expect(svc.writeContext({...binding,enabled:false},'result',match)).rejects.toThrow('behörighet');
  await db.run("INSERT INTO user_permissions(user_id,permission_key,allowed) VALUES(?,'manage_evaluations',0)",[binding.userId]);
  await expect(svc.writeContext(binding,'player_comment',player)).rejects.toThrow('behörighet');
  await db.run("DELETE FROM user_permissions WHERE user_id=? AND permission_key='manage_evaluations'",[binding.userId]);
 });
 it('rolls back service mutations and receipt together',async()=>{
  const c=await command('player_comment',player,{text:'MUST ROLLBACK'});
  await expect(db.transaction(async()=>{await svc.executeWrite(binding,c);throw new Error('simulate failure');})).rejects.toThrow('simulate failure');
  expect((await db.get<{note:string}>('SELECT note FROM player_skill_notes WHERE player_id=?',[player]))!.note).not.toContain('MUST ROLLBACK');
  expect(await db.get('SELECT command_id FROM hermes_write_receipts WHERE command_id=?',[c.commandId])).toBeUndefined();
 });
 it('concurrent changes from same revision cannot overwrite each other',async()=>{
  const c=await command('player_comment',player,{text:'Concurrent one'});
  const outcomes=await Promise.allSettled([svc.executeWrite(binding,c),svc.executeWrite(binding,{...c,commandId:randomUUID(),text:'Concurrent two'})]);
  expect(outcomes.filter(x=>x.status==='fulfilled')).toHaveLength(1);expect(outcomes.filter(x=>x.status==='rejected')).toHaveLength(1);
 });
});
