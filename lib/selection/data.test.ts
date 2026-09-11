import {beforeAll,afterAll,beforeEach,describe,it,expect,vi} from 'vitest';
import postgres from 'postgres';
vi.mock('server-only',()=>({}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('../auth',()=>({getCurrentUser:vi.fn(),canAccessPlayer:vi.fn(),canAccessGroup:vi.fn()}));
vi.mock('../db',()=>({all:execute,get:async(q:string,a:unknown[]) => (await execute(q,a))[0],run:execute}));
import {getCurrentUser,canAccessPlayer,canAccessGroup} from '../auth';
import {getSelectionEvidence} from './data';
import {loadSelectionEvidence} from './reader';
import {saveSelectionPolicy} from './actions';
import {historySummary,trainingPriority} from './rules';
let sql:ReturnType<typeof postgres>;
async function execute(q:string,a:unknown[]=[]){let i=0;return sql.unsafe(q.replace(/\?/g,()=>`$${++i}`),a as never[]);}
describe.skipIf(!process.env.BSK_SYNC_TEST_DATABASE_URL)('uttagningsunderlag och inställningar med PostgreSQL',()=>{
 beforeAll(async()=>{
  sql=postgres(process.env.BSK_SYNC_TEST_DATABASE_URL!,{max:1});
  await sql.unsafe(`CREATE TEMP TABLE players(id int primary key,active int);
    CREATE TEMP TABLE settings(key text primary key,value text);
    CREATE TEMP TABLE groups(id int,group_type text,parent_id int);
    CREATE TEMP TABLE player_group_memberships(player_id int,group_id int,is_primary int,starts_on text,ends_on text);
    CREATE TEMP TABLE development_activities(id text,activity_date text,start_time text,activity_type text,title text,group_id int,external_source text,match_id int);
    CREATE TEMP TABLE development_activity_participation(activity_id text,player_id int,attendance_status text);
    CREATE TEMP TABLE matches(id int,date text,start_time text,location text,periods int,period_minutes int,level text,cancelled int,finished int,match_type text,cup_name text,group_id int);
    CREATE TEMP TABLE match_roster(match_id int,player_id int,callup_status text,selection_status text);
    CREATE TEMP TABLE match_players(match_id int,player_id int);
    INSERT INTO players VALUES(1,1),(2,0);
    INSERT INTO groups VALUES(2,'subgroup',NULL),(6,'subgroup',NULL),(3,'matchgroup',2);
    INSERT INTO player_group_memberships VALUES(1,2,1,NULL,NULL);
    INSERT INTO development_activities VALUES
    ('a','2026-09-09','17:00','training','Träning',2,'svenskalag_browser',NULL),
    ('extra','2026-09-08','18:00','training','Extra Träning',2,'svenskalag_browser',NULL),
    ('b','2026-09-07','18:00','training','Träning',2,'svenskalag_browser',NULL),
    ('c','2026-09-02','18:00','training','Träning',2,'svenskalag_browser',NULL),
    ('d','2026-08-31','18:00','training','Träning',2,'svenskalag_browser',NULL),
    ('future','2026-09-14','18:00','training','Träning',2,'svenskalag_browser',NULL),
    ('old','2026-08-01','18:00','training','Träning',2,'svenskalag_browser',NULL),
    ('other','2026-09-10','18:00','training','Träning',6,'svenskalag_browser',NULL);
    INSERT INTO development_activity_participation VALUES('a',1,'present'),('extra',1,'present'),('b',1,'absent'),('d',1,'present');
    INSERT INTO matches VALUES
    (1,'2026-09-18','17:30','Exempelplan',3,20,'',0,0,'seriespel','',2),
    (2,'2026-09-09','17:30','Exempelplan',3,20,'medel',0,1,'seriespel','',6),
    (3,'2026-09-08','17:30','Exempelplan',3,20,'svar',0,1,'seriespel','',2),
    (4,'2026-09-07','17:30','Exempelplan',3,20,'medel',1,1,'seriespel','',2),
    (5,'2026-09-06','17:30','Exempelplan',3,20,'medel',0,1,'cup','Cup',3),
    (6,'2026-08-01','17:30','Exempelplan',3,20,'medel',0,1,'seriespel','',2);
    INSERT INTO match_roster VALUES(2,1,'accepted',NULL),(3,1,'declined',NULL),(4,1,'declined',NULL),(5,1,'accepted',NULL),(6,1,'declined',NULL);
    INSERT INTO match_players VALUES(2,1),(5,1);
    INSERT INTO settings VALUES('svenskalag_match_metadata:1','{"competitionName":"F2014- 2"}');`);
 });
 afterAll(async()=>{await sql?.end();});
 beforeEach(()=>{vi.mocked(getCurrentUser).mockResolvedValue({id:1,permissions:['manage_squads']} as never);vi.mocked(canAccessPlayer).mockResolvedValue(true);vi.mocked(canAccessGroup).mockResolvedValue(true);});
 it('väljer fyra ordinarie pass, utesluter extra/andra lag/framtid och bevarar okänd närvaro',async()=>{
  const e=(await loadSelectionEvidence(execute as never,[1],1,Date.parse('2026-09-11T09:00Z'))).get(1)!;
  expect(e.training.map(t=>t.id)).toEqual(['a','b','c','d']);
  expect(trainingPriority(e.training,e.policy)).toMatchObject({present:2,unknown:1,rank:1});
  expect(e.target!.level).toBe(2);
 });
 it('räknar över lag, utesluter cup/inställt/äldre och skiljer erbjudande från spel',async()=>{
  const e=(await loadSelectionEvidence(execute as never,[1],1,Date.parse('2026-09-11T09:00Z'))).get(1)!;
  expect(e.matches.map(m=>m.id)).toEqual([3,2]);
  expect(historySummary(e)).toMatchObject({played:1,offered:2,declined:1,opportunities:2});
  await sql`INSERT INTO settings VALUES('svenskalag_presence:2','{}')`;
  expect(historySummary((await loadSelectionEvidence(execute as never,[1],1,Date.parse('2026-09-11T09:00Z'))).get(1)!).played).toBe(0);
  await sql`DELETE FROM settings WHERE key='svenskalag_presence:2'`;
 });
 it('sparar och återläser med versionskontroll utan att ändra svar eller närvaro',async()=>{
  const before=await sql`SELECT * FROM match_roster ORDER BY match_id`;
  const f=new FormData();f.append('pair','2+3');f.set('revision','');
  const r=await saveSelectionPolicy(1,f);expect(r.ok).toBe(true);
  expect((await getSelectionEvidence([1])).get(1)!.policy.pairs).toEqual(['2+3']);
  expect((await saveSelectionPolicy(1,f)).ok).toBe(false);
  f.set('revision',r.revision!);f.delete('pair');expect((await saveSelectionPolicy(1,f)).ok).toBe(true);
  expect(await sql`SELECT * FROM match_roster ORDER BY match_id`).toEqual(before);
 });
 it('nekar andra spelares uppgifter, andra lag, inaktiv spelare och saknad behörighet',async()=>{
  vi.mocked(canAccessPlayer).mockResolvedValue(false);
  await expect(getSelectionEvidence([1])).rejects.toThrow('Spelaråtkomst');
  await expect(saveSelectionPolicy(1,new FormData())).rejects.toThrow('Behörighet');
  vi.mocked(canAccessPlayer).mockResolvedValue(true);vi.mocked(canAccessGroup).mockResolvedValue(false);
  await expect(getSelectionEvidence([1],1)).rejects.toThrow('Matchåtkomst');
  await expect(saveSelectionPolicy(2,new FormData())).rejects.toThrow('aktiv');
  vi.mocked(getCurrentUser).mockResolvedValue({permissions:['view_players']} as never);
  await expect(getSelectionEvidence([1])).rejects.toThrow('Behörighet');
  await expect(saveSelectionPolicy(1,new FormData())).rejects.toThrow('Behörighet');
 });
});
