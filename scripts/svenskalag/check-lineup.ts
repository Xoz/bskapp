import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {publishLineup} from './lineup';
import {ORIGIN,TEAM_PATH} from '../../lib/svenskalag/model';
import type {LineupJob} from '../../lib/svenskalag/outbox';
async function main(){
 const b=await chromium.launch();
 try{
  let stored=['Spelare A'],writes=0;
  const c=await b.newContext();c.setDefaultTimeout(5000);
  await c.route('**/*',async r=>{
   if(r.request().method()!=='GET') throw new Error('Oväntad skrivning');
   const member=(name:string)=>`<li class="player"><label><input type="checkbox"><span>- ${name}<span>11 år</span></span></label></li>`;
   const selected=(name:string)=>`<li class="player"><i class="fa-minus-circle" onclick="this.parentElement.remove()">ta bort</i><div class="attending-fullname">${name}</div></li>`;
   await r.fulfill({contentType:'text/html; charset=utf-8',body:`<script>window.initData={scheduleId:123,isGame:true,teamId:40600,teamPresenceGroups:[{}]}</script><select><option>F2014-Gul</option></select><div id="choose-view">${['Spelare A','Spelare B'].filter(n=>!stored.includes(n)).map(member).join('')}</div><button id="add">Lägg till</button><div class="memberlist match"><li class="leader">Ledare bevaras</li>${stored.map(selected).join('')}</div><script>document.getElementById('add').onclick=()=>document.querySelectorAll('#choose-view input:checked').forEach(e=>{let li=e.closest('li');let n=li.innerText.replace(/^- /,'').replace(/11 år$/,'');let row=document.createElement('li');row.className='player';let name=document.createElement('div');name.className='attending-fullname';name.textContent=n;row.append(name);document.querySelector('.memberlist.match').append(row);li.remove();});</script><input type="button" value="Spara" onclick="fetch('${TEAM_PATH}/controlpanel/presence/savepresence?scheduleid=123',{method:'POST',body:JSON.stringify({names:[...document.querySelectorAll('.attending-fullname')].map(e=>e.textContent),leaders:['Ledare bevaras']})})">`});
  });
  const job:LineupJob={id:'test',matchId:7,sourceId:'123',date:'2026-09-12',baseline:['Spelare A'],names:['Spelare B'],state:'queued',message:'',createdAt:'2026-09-10'};
  const save=async(r:import('playwright').Route)=>{
   writes++;const payload=JSON.parse(r.request().postData()!);assert.deepEqual(payload.leaders,['Ledare bevaras']);stored=payload.names;await r.fulfill({contentType:'application/json',body:'{"isSuccess":true}'});
  };
  assert.equal(await publishLineup(c,job,async()=>{},save),'ok');assert.equal(writes,1);assert.deepEqual(stored,['Spelare B']);
  assert.equal(await publishLineup(c,job,async()=>{},save),'ok');assert.equal(writes,1);
  assert.equal(await publishLineup(c,{...job,names:['Spelare A']},async()=>{},save),'conflict');assert.equal(writes,1);
  console.log('Playwright: tillägg, borttagning, bevarad ledare, verifierad återläsning, konflikt och identiskt återförsök godkända.');
 }finally{await b.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
