import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from "vitest";
import postgres from "postgres";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({revalidatePath:vi.fn()}));
vi.mock("./auth", () => ({getCurrentUser:vi.fn(), canAccessGroup:vi.fn(), canAccessPlayer:vi.fn()}));
vi.mock("./db", () => ({all:execute, get:async(q:string,a:unknown[]) => (await execute(q,a))[0], run:execute}));
import { getCurrentUser, canAccessGroup, canAccessPlayer } from "./auth";
import { getMatchSpaceInputs } from "./matchSpaceData";
import { saveMatchSpaceCapacity } from "./matchSpaceActions";
import { forecastMatchSpace } from "./matchSpace";
let sql: ReturnType<typeof postgres>;
async function execute(query:string,args:unknown[]) {let i=0;return sql.unsafe(query.replace(/\?/g,()=>`$${++i}`), args as never[]);}
describe.skipIf(!process.env.BSK_SYNC_TEST_DATABASE_URL)("matchutrymme med databas och behörighet",()=>{
  beforeAll(async()=>{
    sql=postgres(process.env.BSK_SYNC_TEST_DATABASE_URL!,{max:1});
    await sql.unsafe(`CREATE TEMP TABLE players(id int PRIMARY KEY, active int);
      CREATE TEMP TABLE settings(key text PRIMARY KEY,value text);
      CREATE TEMP TABLE matches(id int PRIMARY KEY,date text,start_time text,periods int,period_minutes int,opponent text,group_id int,cancelled int,finished int);
      CREATE TEMP TABLE match_players(match_id int,player_id int,minutes int);
      CREATE TEMP TABLE match_roster(match_id int,player_id int,selection_status text,callup_status text);
      CREATE TEMP TABLE development_activities(id text PRIMARY KEY,match_id int,activity_date text,start_time text,activity_type text,title text,group_id int);
      CREATE TEMP TABLE development_activity_participation(activity_id text,player_id int,attendance_status text);
      CREATE TEMP TABLE development_activity_callups(activity_id text,player_id int,attendance_status text);
      INSERT INTO players VALUES(1,1),(2,1);
      INSERT INTO matches SELECT id, to_char((now() AT TIME ZONE 'Europe/Stockholm')::date + delta,'YYYY-MM-DD'),'12:00',3,20,'Exempelmotstånd',1,cancelled,finished FROM (VALUES(1,-1,0,1),(2,1,0,0),(3,2,1,0),(4,2,0,0),(5,3,0,0)) v(id,delta,cancelled,finished);
      INSERT INTO match_players VALUES(1,1,20),(1,2,0);
      INSERT INTO match_roster VALUES(2,1,NULL,'accepted'),(3,1,'selected','accepted'),(4,1,'selected','declined'),(5,1,NULL,'pending');
      INSERT INTO development_activities SELECT 'a',NULL,date,'18:00','training','Exempelträning',1 FROM matches WHERE id=1;
      INSERT INTO development_activity_participation VALUES('a',1,'present'),('a',2,'absent');`);
  });
  afterAll(async()=>{await sql?.end();});
  beforeEach(()=>{
    vi.mocked(getCurrentUser).mockResolvedValue({permissions:['view_players','manage_squads']} as never);
    vi.mocked(canAccessGroup).mockResolvedValue(true);vi.mocked(canAccessPlayer).mockResolvedValue(true);
  });
  it("räknar faktisk tid, osäker tid, träning och väntande svar men inte nej eller inställt",async()=>{
    const inputs=await getMatchSpaceInputs([1,2],2);
    expect(inputs.get(1)!.events.map(e=>e.id)).toEqual(['match:1','match:2','match:5','training:a']);
    expect(inputs.get(1)!.events[0].minutes).toBe(20);
    expect(inputs.get(2)!.events[0].minutes).toBe(60);
    expect(inputs.get(2)!.events[0].estimated).toBe(true);
    expect(forecastMatchSpace(inputs.get(1)!).after).toBeLessThanOrEqual(70);
  });
  it("låter rättad källnärvaro gå före bevarad statistik",async()=>{
    await sql`INSERT INTO settings VALUES('svenskalag_presence:1','{}')`;
    await sql`INSERT INTO development_activities(id,match_id,activity_date,activity_type,title) SELECT 'match-presence',1,date,'match','Exempelmatch' FROM matches WHERE id=1`;
    await sql`INSERT INTO development_activity_participation VALUES('match-presence',1,'absent'),('match-presence',2,'present')`;
    const inputs=await getMatchSpaceInputs([1,2]);
    expect(inputs.get(1)!.events.some(e=>e.id==='match:1')).toBe(false);
    expect(inputs.get(2)!.events.some(e=>e.id==='match:1')).toBe(true);
    await sql`DELETE FROM settings WHERE key='svenskalag_presence:1'`;
  });
  it("sparar kapacitet och återläser utan att ändra deltagande eller kallelser",async()=>{
    const before=await sql`SELECT * FROM match_roster ORDER BY match_id`;
    const form=new FormData();form.set('capacity','125');await saveMatchSpaceCapacity(1,form);
    expect((await getMatchSpaceInputs([1])).get(1)!.capacity).toBe(125);
    expect(await sql`SELECT * FROM match_roster ORDER BY match_id`).toEqual(before);
    form.set('capacity','80');await saveMatchSpaceCapacity(1,form);
    expect((await getMatchSpaceInputs([1])).get(1)!.capacity).toBe(80);
  });
  it("nekar ogiltiga värden och obehörig läsning och skrivning",async()=>{
    const form=new FormData();form.set('capacity','151');await expect(saveMatchSpaceCapacity(1,form)).rejects.toThrow();
    form.set('capacity','125');vi.mocked(canAccessPlayer).mockResolvedValue(false);
    await expect(saveMatchSpaceCapacity(1,form)).rejects.toThrow('Behörighet');
    await expect(getMatchSpaceInputs([1])).rejects.toThrow('Spelaråtkomst');
    vi.mocked(canAccessPlayer).mockResolvedValue(true);vi.mocked(canAccessGroup).mockResolvedValue(false);
    await expect(getMatchSpaceInputs([1],2)).rejects.toThrow('tillgänglig');
    vi.mocked(getCurrentUser).mockResolvedValue({permissions:['view_players']} as never);
    await expect(saveMatchSpaceCapacity(1,form)).rejects.toThrow('Behörighet');
    await expect(getMatchSpaceInputs([1],3)).rejects.toThrow('tillgänglig');
  });
});
