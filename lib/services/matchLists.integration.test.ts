import {describe,it,expect,vi} from 'vitest';
import type {CurrentUser} from '../auth';
vi.mock('server-only',()=>({}));
// Kör riktiga läsfrågor mot testschemat, utan sessions- eller produktionsanslutning.
vi.mock('../db',()=>({
  all:async(query:string,args:unknown[]=[])=>{
    const {default:postgres}=await import('postgres');
    const sql=postgres(process.env.BSK_SYNC_TEST_DATABASE_URL!,{max:1});
    try {let index=0;return await sql.unsafe(query.replace(/\?/g,()=>`$${++index}`),args as never[]);}
    finally {await sql.end();}
  },
  get:vi.fn(),batch:vi.fn(),logActivity:vi.fn(),run:vi.fn(),
}));
import {listMobileActivities,listMobileSelectionMatches} from './development';
describe.skipIf(!process.env.BSK_SYNC_TEST_DATABASE_URL)('mobilens gemensamma matchlistor',()=>{
  it('kör kompletta listfrågor med samma källräkning mot schemat',async()=>{
    const actor={roles:['admin'],groupIds:[],permissions:['view_players','manage_squads']} as unknown as CurrentUser;
    for(const rows of [await listMobileActivities(actor),await listMobileSelectionMatches(actor)]) {
      expect(Array.isArray(rows)).toBe(true);
      for(const row of rows) {
        expect(Number.isInteger(row.acceptedCallupCount)).toBe(true);
        expect(row.acceptedCallupCount).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
