import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import postgres from 'postgres';
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../auth', () => ({ getCurrentUser: vi.fn(), canAccessGroup: vi.fn() }));
vi.mock('../db', () => ({
  get: async (query: string, args: unknown[]) => (await execute(query, args))[0],
  run: async (query: string, args: unknown[]) => execute(query, args),
}));
import { getCurrentUser, canAccessGroup } from '../auth';
import { matchPlanPlayersSql } from './players';
import { saveMatchPlan } from './actions';
import { emptyMatchPlan, validMatchPlan, readMatchPlan } from './model';
let sql: ReturnType<typeof postgres>;
async function execute(query: string, args: unknown[]) {
  let i = 0;
  return sql.unsafe(query.replace(/\?/g, () => `$${++i}`), args as never[]);
}

it('validerar formation, koordinater, dubbla spelare och fritext', () => {
  const p = emptyMatchPlan();
  expect(validMatchPlan(p)).toBe(true);
  expect(validMatchPlan({ ...p, formation: 'okänd' })).toBe(false);
  p.spots[0].x = NaN;
  expect(validMatchPlan(p)).toBe(false);
  p.spots[0].x = .5;
  p.spots[0].playerId = p.spots[1].playerId = 1;
  expect(validMatchPlan(p)).toBe(false);
  p.spots[1].playerId = null;
  p.ideas.focus = 'a'.repeat(2001);
  expect(validMatchPlan(p)).toBe(false);
  expect(readMatchPlan('{trasig')).toBeNull();
});

describe.skipIf(!process.env.BSK_SYNC_TEST_DATABASE_URL)('matchplanens sparande', () => {
  beforeAll(async () => {
    sql = postgres(process.env.BSK_SYNC_TEST_DATABASE_URL!, { max: 1 });
    await sql.unsafe(`CREATE TEMP TABLE settings(key text PRIMARY KEY, value text);
      CREATE TEMP TABLE matches(id int PRIMARY KEY, group_id int, cancelled int);
      CREATE TEMP TABLE match_roster(match_id int, player_id int, selection_status text, callup_status text, lineup_x float);
      INSERT INTO matches VALUES(1,1,0),(2,2,0),(3,1,1);
      INSERT INTO match_roster VALUES(1,10,'selected','declined',0.2),(1,11,NULL,'accepted',NULL),(1,12,NULL,'pending',NULL),(1,13,NULL,'declined',NULL),(2,20,'selected','pending',NULL);`);
  });
  afterAll(async () => { await sql?.end(); });
  beforeEach(async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ permissions: ['manage_squads'] } as never);
    vi.mocked(canAccessGroup).mockResolvedValue(true);
    await sql`DELETE FROM settings`;
  });
  it('sparar och återläser utan att ändra trupp, svar eller tidigare positioner', async () => {
    const before = await sql`SELECT * FROM match_roster ORDER BY match_id, player_id`;
    const p = emptyMatchPlan('1-3-2-1'); p.spots[0].playerId = 10; p.ideas.attack = 'Spela oss ur press.';
    expect(await saveMatchPlan(1, 0, p)).toEqual({ revision: 1 });
    expect(readMatchPlan((await sql`SELECT value FROM settings WHERE key='match_plan:1'`)[0].value)?.document).toEqual(p);
    expect(await sql`SELECT * FROM match_roster ORDER BY match_id, player_id`).toEqual(before);
    expect(await sql`SELECT * FROM settings WHERE key='match_plan:2'`).toHaveLength(0);
  });
  it('visar och sparar ja-svar utan uttagning med oförändrade kallelsesvar', async () => {
    const rows = await execute(matchPlanPlayersSql, [1]);
    expect(rows.map(r => r.player_id).sort()).toEqual([10, 11]);
    const before = await sql`SELECT * FROM match_roster ORDER BY match_id, player_id`;
    const p = emptyMatchPlan(); p.spots[0].playerId = 11;
    expect(await saveMatchPlan(1, 0, p)).toEqual({ revision: 1 });
    expect(await sql`SELECT * FROM match_roster ORDER BY match_id, player_id`).toEqual(before);
  });
  it('nekar annan match, obesvarad eller nej utan uttagning och inställd match', async () => {
    const p = emptyMatchPlan();
    p.spots[0].playerId = 20;
    expect((await saveMatchPlan(1, 0, p)).error).toBeTruthy();
    p.spots[0].playerId = 12;
    expect((await saveMatchPlan(1, 0, p)).error).toBeTruthy();
    p.spots[0].playerId = 13;
    expect((await saveMatchPlan(1, 0, p)).error).toBeTruthy();
    expect((await saveMatchPlan(3, 0, emptyMatchPlan())).error).toBeTruthy();
    expect(await sql`SELECT * FROM settings`).toHaveLength(0);
  });
  it('nekar saknad behörighet och annan lagåtkomst', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect((await saveMatchPlan(1, 0, emptyMatchPlan())).error).toBeTruthy();
    vi.mocked(getCurrentUser).mockResolvedValue({ permissions: [] } as never);
    expect((await saveMatchPlan(1, 0, emptyMatchPlan())).error).toBeTruthy();
    vi.mocked(getCurrentUser).mockResolvedValue({ permissions: ['manage_squads'] } as never);
    vi.mocked(canAccessGroup).mockResolvedValue(false);
    expect((await saveMatchPlan(1, 0, emptyMatchPlan())).error).toBeTruthy();
    expect(await sql`SELECT * FROM settings`).toHaveLength(0);
  });
  it('bevarar nyare ändringar och tål identiskt återförsök', async () => {
    const p = emptyMatchPlan();
    expect(await saveMatchPlan(1, 0, p)).toEqual({ revision: 1 });
    expect(await saveMatchPlan(1, 0, p)).toEqual({ revision: 1 });
    const next = { ...p, ideas: { ...p.ideas, focus: 'Bredd' } };
    expect(await saveMatchPlan(1, 1, next)).toEqual({ revision: 2 });
    expect((await saveMatchPlan(1, 1, { ...next, formation: '1-2-2-2' })).error).toBeTruthy();
    expect(readMatchPlan((await sql`SELECT value FROM settings`)[0].value)?.document).toEqual(next);
  });
});
