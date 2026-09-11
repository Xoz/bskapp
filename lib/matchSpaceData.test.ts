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
    await sql.unsafe(`CREATE TEMP TABLE players(id int PRIMARY KEY, active int, preferred_position_primary text DEFAULT '', position text DEFAULT '');
      CREATE TEMP TABLE settings(key text PRIMARY KEY,value text);
      CREATE TEMP TABLE matches(id int PRIMARY KEY,date text,start_time text,periods int,period_minutes int,opponent text,group_id int,cancelled int,finished int);
      CREATE TEMP TABLE groups(id int,parent_id int,group_type text);
      ALTER TABLE matches ADD COLUMN match_type text DEFAULT 'seriespel', ADD COLUMN cup_name text DEFAULT '';
      CREATE TEMP TABLE match_players(match_id int,player_id int,minutes int);
      CREATE TEMP TABLE match_roster(match_id int,player_id int,selection_status text,callup_status text,selected_position text DEFAULT '');
      CREATE TEMP TABLE development_activities(id text PRIMARY KEY,match_id int,activity_date text,start_time text,activity_type text,title text,group_id int);
      CREATE TEMP TABLE development_activity_participation(activity_id text,player_id int,attendance_status text,position text DEFAULT '',updated_at text DEFAULT '');
      CREATE TEMP TABLE development_activity_callups(activity_id text,player_id int,attendance_status text);
      INSERT INTO players(id,active) VALUES(1,1),(2,1);
      INSERT INTO matches(id,date,start_time,periods,period_minutes,opponent,group_id,cancelled,finished) SELECT id, to_char((now() AT TIME ZONE 'Europe/Stockholm')::date + delta,'YYYY-MM-DD'),'12:00',3,20,'Exempelmotstånd',1,cancelled,finished FROM (VALUES(1,-1,0,1),(2,1,0,0),(3,2,1,0),(4,2,0,0),(5,3,0,0)) v(id,delta,cancelled,finished);
      INSERT INTO match_players VALUES(1,1,20),(1,2,0);
      INSERT INTO match_roster(match_id,player_id,selection_status,callup_status) VALUES(2,1,NULL,'accepted'),(3,1,'selected','accepted'),(4,1,'selected','declined'),(5,1,NULL,'pending');
      INSERT INTO development_activities SELECT 'a',NULL,date,'18:00','training','Exempelträning',1 FROM matches WHERE id=1;
      INSERT INTO development_activity_participation(activity_id,player_id,attendance_status) VALUES('a',1,'present'),('a',2,'absent');`);
  });
  afterAll(async()=>{await sql?.end();});
  beforeEach(()=>{
    vi.mocked(getCurrentUser).mockResolvedValue({permissions:['view_players','manage_squads']} as never);
    vi.mocked(canAccessGroup).mockResolvedValue(true);vi.mocked(canAccessPlayer).mockResolvedValue(true);
  });
  it("räknar jämnt delad tid, träning och väntande svar men inte nej eller inställt",async()=>{
    const inputs=await getMatchSpaceInputs([1,2],2);
    expect(inputs.get(1)!.events.map(e=>e.id)).toEqual(['match:1','match:2','match:5','training:a']);
    expect(inputs.get(1)!.events[0].minutes).toBe(60);
    expect(inputs.get(2)!.events[0].minutes).toBe(60);
    expect(inputs.get(2)!.events[0].estimated).toBe(true);
    expect(forecastMatchSpace(inputs.get(1)!).after).toBeLessThanOrEqual(94);
  });
  it("låter rättad källnärvaro gå före bevarad statistik",async()=>{
    await sql`INSERT INTO settings VALUES('svenskalag_presence:1','{}')`;
    await sql`INSERT INTO development_activities(id,match_id,activity_date,activity_type,title) SELECT 'match-presence',1,date,'match','Exempelmatch' FROM matches WHERE id=1`;
    await sql`INSERT INTO development_activity_participation(activity_id,player_id,attendance_status) VALUES('match-presence',1,'absent'),('match-presence',2,'present')`;
    const inputs=await getMatchSpaceInputs([1,2]);
    expect(inputs.get(1)!.events.some(e=>e.id==='match:1')).toBe(false);
    expect(inputs.get(2)!.events.some(e=>e.id==='match:1')).toBe(true);
    await sql`DELETE FROM settings WHERE key='svenskalag_presence:1'`;
  });
  it("räknar hela deltagarantalet för en enda profil, med målvakt och 9v9",async()=>{
    await sql`INSERT INTO players(id,active,preferred_position_primary) SELECT n,1,CASE WHEN n=3 THEN 'Målvakt' ELSE '' END FROM generate_series(3,10) n`;
    await sql`INSERT INTO match_players SELECT 1,n,0 FROM generate_series(3,8) n`;
    await sql`INSERT INTO match_roster(match_id,player_id,callup_status) SELECT 2,n,'accepted' FROM generate_series(2,8) n`;
    await sql`INSERT INTO match_roster(match_id,player_id,selection_status,callup_status) VALUES(2,9,'selected',NULL),(2,10,NULL,'pending')`;
    try {
      let inputs=await getMatchSpaceInputs([1,3],2);
      expect(inputs.get(1)!.events[0].minutes).toBeCloseTo(360/7);
      expect(inputs.get(3)!.events[0].minutes).toBe(60);
      expect(inputs.get(1)!.target!.minutes).toBeCloseTo(360/7);
      expect((await getMatchSpaceInputs([9],2)).get(9)!.target!.minutes).toBe(45);
      await sql`UPDATE matches SET period_minutes=25 WHERE id=2`;
      await sql`UPDATE match_roster SET callup_status='accepted' WHERE match_id=2 AND player_id IN (9,10)`;
      inputs=await getMatchSpaceInputs([1,3],2);
      expect(inputs.get(1)!.target!.duration).toBe(75);
      expect(inputs.get(1)!.target!.minutes).toBeCloseTo(600/9);
      expect(inputs.get(3)!.target!.minutes).toBe(75);
      // Källnärvaro avgör också nämnaren, inte kvarliggande statistik.
      await sql`INSERT INTO settings VALUES('svenskalag_presence:1','{}')`;
      await sql`UPDATE development_activity_participation SET attendance_status='present' WHERE activity_id='match-presence' AND player_id=1`;
      await sql`INSERT INTO development_activity_participation(activity_id,player_id,attendance_status) SELECT 'match-presence',n,'present' FROM generate_series(3,7) n`;
      expect((await getMatchSpaceInputs([1])).get(1)!.events[0].minutes).toBe(60);
    } finally {
      await sql`DELETE FROM settings WHERE key='svenskalag_presence:1'`;
      await sql`DELETE FROM development_activity_participation WHERE player_id>=3`;
      await sql`UPDATE development_activity_participation SET attendance_status='absent' WHERE activity_id='match-presence' AND player_id=1`;
      await sql`DELETE FROM match_players WHERE player_id>=3`;
      await sql`DELETE FROM match_roster WHERE player_id>=2`;
      await sql`DELETE FROM players WHERE id>=3`;
      await sql`UPDATE matches SET period_minutes=20 WHERE id=2`;
    }
  });
  it("utesluter spelade och framtida cuper samt nekar cup som batterimål",async()=>{
    await sql`UPDATE matches SET match_type='cup' WHERE id=1`;
    await sql`INSERT INTO settings VALUES('svenskalag_match_metadata:2','{"scope":"cup"}')`;
    try {
      const input=(await getMatchSpaceInputs([1])).get(1)!;
      expect(input.events.map(e=>e.id)).toEqual(['match:5','training:a']);
      await expect(getMatchSpaceInputs([1],2)).rejects.toThrow('tillgänglig');
    } finally {
      await sql`UPDATE matches SET match_type='seriespel' WHERE id=1`;
      await sql`DELETE FROM settings WHERE key='svenskalag_match_metadata:2'`;
    }
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
