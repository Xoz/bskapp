// Isolated integration proof. Refuses production URLs and any real-player fixture.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const origin = process.env.BSK_NATIVE_QA_ORIGIN || 'http://localhost:4899';
const url = new URL(origin);
assert(['localhost','127.0.0.1'].includes(url.hostname) && url.protocol === 'http:' && url.port === '4899', 'Only isolated local QA is allowed');
const login = await fetch(origin + '/api/auth/dev', {redirect:'manual'});
const cookie = login.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
assert(cookie, 'QA session required');
async function request(query='', body) {
 const response = await fetch(origin + '/api/desktop/editor' + query, {method: body ? 'POST':'GET',headers:{cookie,origin,'content-type':'application/json'},body:body ? JSON.stringify(body):undefined,redirect:'error'});
 return {status:response.status, body:await response.json()};
}
const base = await request('?kind=checkpoint&id=1');assert.equal(base.status,200);assert.match(base.body.name,/^QA /);
const statuses = Object.fromEntries(base.body.skills.map(s=>[s.id,base.body.statuses[s.id] || 'not_started']));
const payload={kind:'checkpoint',playerId:1,commandId:randomUUID(),date:base.body.today,coach:'QA Native Integration',version:base.body.version,statuses,focus:base.body.focus.slice(0,2),strengths:'QA atomic snapshot',focusNote:'',wellbeing:''};
const [first,concurrent] = await Promise.all([request('',payload),request('',payload)]);
assert([first.status,concurrent.status].includes(200));assert([first.status,concurrent.status].every(s=>[200,409].includes(s)));
assert.equal((await request('',payload)).status,200,'identical replay succeeds');
assert.equal((await request('',{...payload,strengths:'different'})).status,409,'changed replay is rejected');
assert.equal((await request('',{...payload,commandId:randomUUID()})).status,409,'stale snapshot rejected');
const updated=await request('?kind=conversation&id=1');assert.equal(updated.status,200);
const conversation={kind:'conversation',playerId:1,commandId:randomUUID(),checkpointId:updated.body.preparation.checkpointId || '',date:updated.body.today,outcome:'none',note:'QA native retry',perspective:'',agreement:'',followup:''};
assert.equal((await request('',conversation)).status,200);assert.equal((await request('',conversation)).status,200);
const training=await request('?kind=training&id=nytt');assert.equal(training.status,200);
const pass={kind:'training',id:training.body.id,revision:0,document:{...training.body.document,title:'QA Native Integration',blocks:[{id:randomUUID(),minutes:8,diagram:training.body.bank[0].model}]}};
assert.equal((await request('',pass)).body.revision,1);assert.equal((await request('',pass)).body.revision,1);
assert.equal((await request('',{...pass,document:{...pass.document,title:'QA conflicting revision'}})).status,409);
const loaded=await request('?kind=training&id='+pass.id);assert.deepEqual(loaded.body.document,pass.document);
console.log('PASS: native API roundtrip, atomic checkpoint, concurrent retry, replay conflict, stale basis, conversation replay and owned training revision. Only QA data used.');
