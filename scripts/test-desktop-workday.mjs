// Local synthetic API integration only. Never accepts production destinations.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const origin='http://localhost:4899';
const login=await fetch(origin+'/api/auth/dev',{redirect:'manual'});
const cookie=login.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
async function request(query='',body){const response=await fetch(origin+'/api/desktop/workday'+query,{method:body?'POST':'GET',headers:{cookie,origin,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:response.status,body:await response.json()};}
const profile=await request('?kind=player&id=1');assert.equal(profile.status,200);assert.match(profile.body.profile.name,/^QA /);
const first=await request('?kind=match&id=1');assert.equal(first.status,200);assert.match(first.body.match.opponent,/^QA /);
const plan={kind:'plan',matchId:1,commandId:randomUUID(),version:first.body.versions.plan,revision:first.body.plan.revision,document:{...first.body.plan.document,ideas:{...first.body.plan.document.ideas,focus:'QA workday integration '+randomUUID()}}};
assert.equal((await request('',plan)).status,200);assert.equal((await request('',plan)).status,200,'identical receipt replay');
assert.equal((await request('',{...plan,document:{...plan.document,ideas:{...plan.document.ideas,focus:'different'}}})).status,409,'changed replay');
const loaded=await request('?kind=match&id=1');assert.deepEqual(loaded.body.plan.document,plan.document);assert.deepEqual(loaded.body.roster,first.body.roster,'plan leaves replies and selection unchanged');
assert.equal((await request('',{...plan,commandId:randomUUID()})).status,409,'stale match snapshot');
const selection={kind:'selection',matchId:1,commandId:randomUUID(),version:loaded.body.versions.selection,players:[{playerId:1,position:'Mittfältare'}],acknowledged:true};
assert.equal((await request('',selection)).status,200);assert.equal((await request('',selection)).status,200);
const selected=await request('?kind=match&id=1');assert.equal(selected.body.roster.find(p=>p.player_id===1).callup_status,'accepted');assert.equal(selected.body.roster.find(p=>p.player_id===2).callup_status,'pending');
const evaluation=await request('?kind=match&id=2');assert.equal(evaluation.status,200);assert.match(evaluation.body.match.opponent,/^QA /);
const e={kind:'evaluation',matchId:2,commandId:randomUUID(),version:evaluation.body.versions.evaluation,answers:evaluation.body.evaluation.players.map(p=>({playerId:p.id,rating:3,ratingComment:'QA exact retry',selfComparison:null,matchImpact:null,reasonTag:'',skipped:false})),context:{ourScore:2,opponentScore:1,coachComment:'QA workday integration'}};
assert.equal((await request('',e)).status,200);assert.equal((await request('',e)).status,200);
const readback=await request('?kind=match&id=2');assert.equal(readback.body.evaluation.players[0].rating,3);assert.equal(readback.body.evaluation.match.ourScore,2);
console.log('PASS: synthetic native profile, match plan roundtrip, selection replies preserved, evaluation, exact replay and stale conflict.');
