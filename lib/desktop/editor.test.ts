import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ user: vi.fn(), access: vi.fn(), all: vi.fn(), get: vi.fn(), tx: vi.fn(), player: vi.fn(), latest: vi.fn(), statuses: vi.fn(), savePlan: vi.fn(), saveConversation: vi.fn(), revalidate: vi.fn() }));
vi.mock('../auth', () => ({ getCurrentUser:m.user, canAccessPlayer:m.access, isStaffRole:(r:string)=>r==='coach', requestOrigin:(r:Request)=>new URL(r.url).origin }));
vi.mock('../db', () => ({all:m.all,get:m.get,desktopTransaction:m.tx}));
vi.mock('../queries', () => ({getPlayer:m.player,getLatestDevelopmentCheckpoint:m.latest,getPlayerSkillStatuses:m.statuses}));
vi.mock('../training/actions', () => ({saveTrainingPlan:m.savePlan}));
vi.mock('../treeConversationActions', () => ({saveTreeConversation:m.saveConversation}));
vi.mock('next/cache', () => ({revalidatePath:m.revalidate}));
import { readDesktopEditor, writeDesktopEditor } from './editor';
import { POST } from '../../app/api/desktop/editor/route';
import { SKILLS } from '../skillTrappan';
import { NextRequest } from 'next/server';
const user={id:7,primaryRole:'coach',name:'QA Coach',permissions:['manage_evaluations','view_players','view_private_player_data']};
const commandId='fa9f218c-12ab-4cc4-9999-000000000001';
const plan={version:1,title:'QA Native',date:'',blocks:[]};
const checkpoint=()=>({kind:'checkpoint',playerId:1,commandId,date:'2026-10-12',coach:'QA Coach',strengths:'',focusNote:'',wellbeing:'',version:'stale',focus:[],statuses:Object.fromEntries(SKILLS.map(s=>[s.id,'not_started']))});
beforeEach(()=>{vi.clearAllMocks();m.user.mockResolvedValue(user);m.access.mockResolvedValue(true);m.all.mockResolvedValue([]);m.get.mockResolvedValue(undefined);m.tx.mockImplementation(async work=>work(m.all));m.player.mockResolvedValue({id:1,name:'QA',active:1});m.latest.mockResolvedValue(null);m.statuses.mockResolvedValue({});m.savePlan.mockResolvedValue({revision:1});m.saveConversation.mockResolvedValue({saved:true});});
it('rejects missing/staff/permission/group access before reading private data or writing',async()=>{
 for(const candidate of [null,{...user,primaryRole:'parent'},{...user,permissions:['manage_evaluations']}]){
  m.user.mockResolvedValue(candidate);expect((await readDesktopEditor('checkpoint','1')).status).toBe(403);expect((await writeDesktopEditor(checkpoint())).status).toBe(403);
 }
 m.user.mockResolvedValue(user);m.access.mockResolvedValue(false);expect((await readDesktopEditor('conversation','1')).status).toBe(403);
 expect(m.player).not.toHaveBeenCalled();expect(m.tx).not.toHaveBeenCalled();expect(m.saveConversation).not.toHaveBeenCalled();
});
it('owner-scopes training reads and uses the existing revision protected save',async()=>{
 expect((await readDesktopEditor('training',commandId)).status).toBe(404);expect(m.get.mock.calls[0][1]).toEqual([commandId,7]);
 expect((await writeDesktopEditor({kind:'training',id:commandId,revision:0,document:plan})).status).toBe(200);expect(m.savePlan).toHaveBeenCalledWith(commandId,0,plan);
 m.savePlan.mockResolvedValue({error:'conflict'});expect((await writeDesktopEditor({kind:'training',id:commandId,revision:0,document:plan})).status).toBe(409);
});
it('rejects malformed drawings, dates, statuses and excess focus before transactions',async()=>{
 for(const patch of [{date:'2026-02-30'},{focus:['unknown']},{focus:SKILLS.slice(0,3).map(s=>s.id)},{statuses:{[SKILLS[0].id]:'invalid'}},{strengths:'x'.repeat(2001)}]) expect((await writeDesktopEditor({...checkpoint(),...patch})).status).toBe(400);
 expect(m.tx).not.toHaveBeenCalled();
 expect((await writeDesktopEditor({kind:'training',id:commandId,revision:0,document:{...plan,blocks:[{id:'1',minutes:0,diagram:{}}]}})).status).toBe(400);
});
it('rejects stale checkpoint version without changing current status or history',async()=>{
 expect((await writeDesktopEditor(checkpoint())).status).toBe(409);
 expect(m.all.mock.calls.some(([sql])=>/^INSERT|^UPDATE/.test(sql))).toBe(false);
});
it('writes snapshot and current status atomically, and accepts an identical retry without writes',async()=>{
 const read=await readDesktopEditor('checkpoint','1');const version=(read.body as {version:string}).version;
 const input={...checkpoint(),version};m.all.mockClear();
 expect((await writeDesktopEditor(input)).status).toBe(200);expect(m.tx).toHaveBeenCalled();
 expect(m.all.mock.calls.filter(([sql])=>sql.startsWith('INSERT INTO development_checkpoints'))).toHaveLength(1);
 expect(m.all.mock.calls.filter(([sql])=>sql.startsWith('INSERT INTO development_checkpoint_skills'))).toHaveLength(SKILLS.length);
 expect(m.all.mock.calls.filter(([sql])=>sql.startsWith('INSERT INTO player_skill_status'))).toHaveLength(SKILLS.length);
 m.all.mockClear();m.all.mockImplementation(async(sql:string)=>sql.startsWith('SELECT player_id,date')?[{player_id:1,date:input.date,coach_name:input.coach,strengths:'',focus_note:'',wellbeing_note:''}]:sql.startsWith('SELECT skill_id,status,is_focus')?SKILLS.map(s=>({skill_id:s.id,status:'not_started',is_focus:0})):[]);
 expect((await writeDesktopEditor(input)).status).toBe(200);expect(m.all.mock.calls.some(([sql])=>/^INSERT|^UPDATE/.test(sql))).toBe(false);
 expect((await writeDesktopEditor({...input,strengths:'different'})).status).toBe(409);
});
it('delegates conversation validation and idempotency to existing web command',async()=>{
 const input={kind:'conversation',playerId:1,commandId,checkpointId:'',date:'2026-10-12',outcome:'none',note:'',perspective:'',agreement:'',followup:''};
 expect((await writeDesktopEditor(input)).status).toBe(200);const form=m.saveConversation.mock.calls[0][1] as FormData;expect(form.get('command_id')).toBe(commandId);expect(form.get('outcome')).toBe('none');
 expect((await writeDesktopEditor({...input,note:123})).status).toBe(400);
});
it('rejects cross-origin and non-JSON POSTs before invoking save commands',async()=>{
 for(const [origin,type,status] of [['https://evil.test','application/json',403],['https://bsk2014.se','text/plain',415]] as const){
  const r=await POST(new NextRequest('https://bsk2014.se/api/desktop/editor',{method:'POST',headers:{origin,'content-type':type},body:'{}'}));expect(r.status).toBe(status);expect(r.headers.get('cache-control')).toBe('private, no-store');
 }
 expect(m.user).not.toHaveBeenCalled();
});
it('turns serialization failures into a safe same-command retry',async()=>{
 m.tx.mockRejectedValue({code:'40001'});expect((await writeDesktopEditor(checkpoint())).status).toBe(409);
});
