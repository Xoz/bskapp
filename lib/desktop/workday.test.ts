import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({user:vi.fn(),group:vi.fn(),playerAccess:vi.fn(),get:vi.fn(),all:vi.fn(),run:vi.fn(),batch:vi.fn(),tx:vi.fn(),log:vi.fn(),players:vi.fn(),player:vi.fn(),profile:vi.fn(),development:vi.fn(),checkpoints:vi.fn(),conversations:vi.fn(),evaluation:vi.fn(),saveEvaluation:vi.fn(),savePlan:vi.fn(),checkSelection:vi.fn(),revalidate:vi.fn()}));
vi.mock('../auth',()=>({getCurrentUser:m.user,isStaffRole:(r:string)=>r==='coach',canAccessGroup:m.group,canAccessPlayer:m.playerAccess,requestOrigin:(r:Request)=>new URL(r.url).origin}));
vi.mock('../db',()=>({all:m.all,get:m.get,run:m.run,batch:m.batch,transaction:m.tx,logActivity:m.log}));
vi.mock('../queries',()=>({getPlayers:m.players,getPlayer:m.player,getDevelopmentCheckpoints:m.checkpoints,getPlayerConversations:m.conversations}));
vi.mock('../services/development',()=>({getMobilePlayer:m.profile,getMobilePlayerDevelopment:m.development}));
vi.mock('../services/matchEvaluationMobile',()=>({getMobileMatchEvaluation:m.evaluation,saveMobileMatchEvaluation:m.saveEvaluation}));
vi.mock('../selection/save',()=>({checkSelectionDraft:m.checkSelection}));
vi.mock('../matchPlan/actions',()=>({saveMatchPlan:m.savePlan}));
vi.mock('next/cache',()=>({revalidatePath:m.revalidate}));
import {readWorkday,writeWorkday} from './workday';
import {POST} from '../../app/api/desktop/workday/route';
import {NextRequest} from 'next/server';
const actor={id:7,primaryRole:'coach',permissions:['view_matches','view_players','view_private_player_data','manage_squads','manage_evaluations']};
const match={id:1,date:'2099-01-01',start_time:'18:00',opponent:'QA',home_away:'home',group_id:1,location:'QA',finished:0,cancelled:0,level:'3',formation:'',our_score:null,opponent_score:null};
const commandId='12345678-1234-4123-8123-123456789abc';
let receipt:string|null=null;
beforeEach(()=>{vi.clearAllMocks();receipt=null;m.user.mockResolvedValue(actor);m.group.mockResolvedValue(true);m.playerAccess.mockResolvedValue(true);m.player.mockResolvedValue({active:1});m.players.mockResolvedValue([{id:1,name:'QA',position:'Mittfältare'}]);m.all.mockResolvedValue([{player_id:1,name:'QA',selected_position:'',selection_status:null,callup_status:'accepted',updated_at:'qa'}]);m.get.mockImplementation(async(sql:string,args:unknown[])=>sql.includes('FROM matches')?match:String(args?.[0]).startsWith('desktop_command:')&&receipt?{value:receipt}:null);m.run.mockImplementation(async(sql:string,args:unknown[])=>{if(sql.startsWith('INSERT INTO settings'))receipt=String(args[1]);return []});m.tx.mockImplementation(async(work:()=>Promise<unknown>)=>work());m.profile.mockResolvedValue({name:'QA'});m.development.mockResolvedValue({});m.checkpoints.mockResolvedValue([]);m.conversations.mockResolvedValue([]);m.checkSelection.mockResolvedValue(undefined);m.savePlan.mockResolvedValue({revision:1});});
it('denies unauthorized profile reads before querying private history',async()=>{
 for(const user of [null,{...actor,primaryRole:'parent'},{...actor,permissions:['view_players']}]){m.user.mockResolvedValue(user);expect((await readWorkday('player',1)).status).toBe(403)}
 m.user.mockResolvedValue(actor);m.playerAccess.mockResolvedValue(false);expect((await readWorkday('player',1)).status).toBe(403);
 expect(m.profile).not.toHaveBeenCalled();expect(m.checkpoints).not.toHaveBeenCalled();
});
it('rejects inaccessible match and never invokes save commands',async()=>{
 m.group.mockResolvedValue(false);expect((await readWorkday('match',1)).status).toBe(404);
 expect((await writeWorkday({kind:'selection',matchId:1,commandId,version:'x',players:[]})).status).toBe(404);expect(m.batch).not.toHaveBeenCalled();
});
it('checks version before writing and preserves reply/participation on selection',async()=>{
 const loaded=await readWorkday('match',1);const version=(loaded.body as {versions:{selection:string}}).versions.selection;
 expect((await writeWorkday({kind:'selection',matchId:1,commandId,version:'stale',players:[]})).status).toBe(409);expect(m.batch).not.toHaveBeenCalled();
 const b={kind:'selection',matchId:1,commandId,version,players:[{playerId:1,position:'Mittfältare'}],acknowledged:true};
 expect((await writeWorkday(b)).status).toBe(200);expect(m.checkSelection).toHaveBeenCalledWith(1,[{id:1,position:'Mittfältare'}],true);
 const statements=m.batch.mock.calls[0][0];expect(JSON.stringify(statements)).not.toMatch(/callup_status\s*=|match_players/);
 expect((await writeWorkday(b)).status).toBe(200);expect(m.batch).toHaveBeenCalledTimes(1);
 expect((await writeWorkday({...b,players:[]})).status).toBe(409);
});
it('rejects out of scope players and unsupported match stages',async()=>{
 const loaded=await readWorkday('match',1);const version=(loaded.body as {versions:{selection:string}}).versions.selection;
 expect((await writeWorkday({kind:'selection',matchId:1,commandId,version,players:[{playerId:999,position:''}]})).status).toBe(400);
 m.get.mockImplementation(async(sql:string)=>sql.includes("FROM matches")?{...match,cancelled:1}:null);expect((await writeWorkday({kind:'selection',matchId:1,commandId,version,players:[]})).status).toBe(403);expect(m.batch).not.toHaveBeenCalled();
});
it('delegates match plan save under the same transaction and revision',async()=>{
 const loaded=await readWorkday('match',1);const w=loaded.body as {versions:{plan:string};plan:{document:unknown}};
 expect((await writeWorkday({kind:'plan',matchId:1,commandId,version:w.versions.plan,revision:0,document:w.plan.document})).status).toBe(200);expect(m.savePlan).toHaveBeenCalledWith(1,0,w.plan.document);
});
it('requires same-origin JSON and no-store responses',async()=>{
 const req=new NextRequest('https://bsk2014.se/api/desktop/workday',{method:'POST',headers:{origin:'https://evil.test','content-type':'application/json'},body:'{}'});
 const result=await POST(req);expect(result.status).toBe(403);expect(result.headers.get('cache-control')).toBe('private, no-store');expect(m.tx).not.toHaveBeenCalled();
});
it('returns retryable conflict on serialization failure',async()=>{m.tx.mockRejectedValueOnce(Object.assign(new Error('QA'),{code:'40001'}));expect((await writeWorkday({kind:'plan',matchId:1,commandId,version:'qa'})).status).toBe(409)});

it('returns known validation errors without turning them into offline retries',async()=>{
 const w=(await readWorkday('match',1)).body as {versions:{plan:string}};
 m.savePlan.mockRejectedValueOnce(Object.assign(new Error('QA invalid score'),{code:'invalid',status:400}));
 expect((await writeWorkday({kind:'plan',matchId:1,commandId,version:w.versions.plan,revision:0,document:{}})).status).toBe(400);
 expect(m.run.mock.calls.some(c=>String(c[0]).startsWith('INSERT INTO settings'))).toBe(false);
});
