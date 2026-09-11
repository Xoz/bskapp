import {beforeAll,afterAll,beforeEach,describe,it,expect,vi} from 'vitest';
import postgres from 'postgres';
vi.mock('server-only',()=>({}));
vi.mock('../auth',()=>({loadCurrentUserById:vi.fn(),isStaffRole:(r:string)=>['admin','coach','leader','head_coach'].includes(r)}));
vi.mock('../db',()=>({all:execute,get:async(q:string,a:unknown[]) => (await execute(q,a))[0]}));
import {loadCurrentUserById} from '../auth';
import {readLoans} from './loans';
let sql:ReturnType<typeof postgres>;
async function execute(q:string,a:unknown[]=[]){let i=0;return sql.unsafe(q.replace(/\?/g,()=>`$${++i}`),a as never[]);}
const binding={userId:1,sourceGroupId:2,targetGroupIds:[6]},now=Date.parse('2026-09-11T06:00:00Z');
describe.skipIf(!process.env.BSK_LOAN_TEST_DATABASE_URL)('låneunderlag SQL och behörighet',()=>{
 beforeAll(async()=>{
 const url=process.env.BSK_LOAN_TEST_DATABASE_URL!;if(!/localhost|127\.0\.0\.1/.test(url)||!url.endsWith('bsk_loan_test'))throw new Error('Enbart separat lokal testdatabas');
 sql=postgres(url,{max:1});
 await sql.unsafe(`CREATE SCHEMA bsk_hermes; CREATE TABLE bsk_hermes.binding(singleton boolean,user_id int,group_id int); INSERT INTO bsk_hermes.binding VALUES(true,1,2);
 CREATE TEMP TABLE groups(id int,parent_id int,group_type text,name text,active int);
 INSERT INTO groups VALUES(2,NULL,'subgroup','Gul',1),(6,NULL,'subgroup','Grön',1),(9,NULL,'subgroup','F15',1);
 CREATE TEMP TABLE players(id int,name text,active int,preferred_position_primary text DEFAULT '',position text DEFAULT '');
 INSERT INTO players(id,name,active) VALUES(1,'Egen',1),(2,'Gäst',1),(3,'Utgången',1),(4,'Inaktiv',0);
 CREATE TEMP TABLE player_group_memberships(player_id int,group_id int,starts_on text,ends_on text);
 INSERT INTO player_group_memberships VALUES(1,2,NULL,NULL),(2,9,NULL,NULL),(3,2,NULL,'2026-09-11'),(4,2,NULL,NULL);
 CREATE TEMP TABLE matches(id int,date text,start_time text,opponent text,location text,group_id int,periods int,period_minutes int,cancelled int,finished int,match_type text,cup_name text);
 INSERT INTO matches VALUES(171,'2026-09-12','10:15','Grönmatch','B',6,3,20,0,0,'seriespel',''),(7,'2026-09-12','09:00','Egenmatch','A',2,3,20,0,0,'seriespel',''),(8,'2026-09-12','09:00','Inställd','A',6,3,20,1,0,'seriespel',''),(9,'2026-09-12','09:00','Cup','A',6,3,20,0,0,'cup','Cup');
 CREATE TEMP TABLE match_roster(match_id int,player_id int,callup_status text,selection_status text,selected_position text DEFAULT '');
 INSERT INTO match_roster(match_id,player_id,callup_status) VALUES(7,1,'accepted'),(7,2,'accepted'),(8,1,'accepted');
 CREATE TEMP TABLE match_players(match_id int,player_id int);
 CREATE TEMP TABLE settings(key text,value text);
 INSERT INTO settings VALUES('svenskalag_sync_status','{"state":"ok","lastSuccess":"2026-09-11T06:00:00Z"}'),('svenskalag_green_sync_status','{"state":"ok","lastSuccess":"2026-09-11T06:00:00Z"}');
 CREATE TEMP TABLE development_activities(id text,match_id int,activity_date text,start_time text,activity_type text,title text,group_id int);
 CREATE TEMP TABLE development_activity_participation(activity_id text,player_id int,attendance_status text,position text,updated_at text);
 CREATE TEMP TABLE development_activity_callups(activity_id text,player_id int,attendance_status text);`);
 });
 afterAll(async()=>{if(sql){await sql.unsafe('DROP SCHEMA bsk_hermes CASCADE');await sql.end();}});
 beforeEach(()=>vi.mocked(loadCurrentUserById).mockResolvedValue({id:1,roles:['coach'],groupIds:[2,6],permissions:['view_players','view_matches','view_statistics']} as never));
 it('ger bara egna aktiva giltiga spelare, blockerar accepted och undantar inställt',async()=>{
 const r=await readLoans(binding,171,now);if(!('candidates' in r))throw Error('inget underlag');
 expect(r.candidates.map(p=>p.id)).toEqual([1]);expect(r.candidates[0].category).toBe('upptagen_enligt_tidsantagande');expect(r.candidates[0].commitments.map(m=>m.id)).toEqual([7]);
 });
 it('listar bara tillåtet mållag och inte cup/inställd',async()=>{
 const r=await readLoans(binding,undefined,now);if(!('targetMatches' in r))throw Error('ingen lista');expect(r.targetMatches.map(m=>m.id)).toEqual([171]);
 await expect(readLoans(binding,7,now)).rejects.toThrow();
 });
 it('ändrad integrationsbindning nekas direkt',async()=>{
 await sql.unsafe('UPDATE bsk_hermes.binding SET group_id=6');
 try {await expect(readLoans(binding,171,now)).rejects.toThrow();} finally {await sql.unsafe('UPDATE bsk_hermes.binding SET group_id=2');}
 });
 it('återkallat konto, rättighet, lag och ändrad binding nekas direkt',async()=>{
 vi.mocked(loadCurrentUserById).mockResolvedValue(null);await expect(readLoans(binding,171,now)).rejects.toThrow();
 vi.mocked(loadCurrentUserById).mockResolvedValue({id:1,roles:['coach'],groupIds:[2],permissions:['view_players','view_matches','view_statistics']} as never);await expect(readLoans(binding,171,now)).rejects.toThrow();
 vi.mocked(loadCurrentUserById).mockResolvedValue({id:1,roles:['coach'],groupIds:[2,6],permissions:['view_players']} as never);await expect(readLoans(binding,171,now)).rejects.toThrow();
 });
});
