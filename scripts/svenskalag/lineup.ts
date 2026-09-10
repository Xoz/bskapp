import type {BrowserContext,Page} from 'playwright';
import {ORIGIN,TEAM_PATH,nameKey} from '../../lib/svenskalag/model';
import {validLineup,sameLineup,publicationDecision,type LineupJob} from '../../lib/svenskalag/outbox';
const clean=(name:string)=>name.replace(/^\s*\d+\.\s*/,'').split(',')[0].trim();
export async function readLineup(page:Page,sourceId:string):Promise<string[]> {
  page.setDefaultTimeout(15000);
  if(!/^\d+$/.test(sourceId)) throw new Error('Ogiltig match');
  const url=`${ORIGIN}${TEAM_PATH}/kontrollpanelen/presence/chooseparticipants/${sourceId}`;
  const response=await page.goto(url,{waitUntil:'domcontentloaded'});
  if(!response?.ok()||page.url()!==url) throw new Error('Laguttagningen kunde inte läsas');
  await page.locator('.memberlist.match').waitFor({state:'attached'});
  const identity=await page.evaluate(()=>{const d=(window as unknown as {initData:{scheduleId:number;isGame:boolean;teamId:number}}).initData;return {id:d.scheduleId,isGame:d.isGame,teamId:d.teamId};});
  if(Number(identity.id)!==Number(sourceId)||!identity.isGame||Number(identity.teamId)!==40600) throw new Error('Fel match eller lag i redigeraren');
  if(await page.locator('.memberlist.match').count()!==1||await page.evaluate(()=> (window as unknown as {initData?:{teamPresenceGroups?:unknown[]}}).initData?.teamPresenceGroups?.length)!==1) throw new Error('Flera laguppställningar behöver granskas');
  const names=(await page.locator('.memberlist.match li.player .attending-fullname').allTextContents()).map(clean);
  if(!validLineup(names)) throw new Error('Tvetydig laguppställning');
  return names;
}
/** Uses the real editor; only its one observed save endpoint is allowed to write. */
export async function publishLineup(context:BrowserContext,job:LineupJob,beforeWrite:()=>Promise<void>,saveRequest:(route:import('playwright').Route)=>Promise<void>=route=>route.continue()):Promise<'ok'|'conflict'> {
  const page=await context.newPage();
  try {
    const current=await readLineup(page,job.sourceId);
    const originalGroups=await page.evaluate(()=>JSON.stringify((window as unknown as {initData:{teamPresenceGroups:unknown[]}}).initData.teamPresenceGroups));
    const decision=publicationDecision(current,job);
    if(decision==='done') return 'ok';
    if(decision==='conflict') return 'conflict';
    // All edits below remain in the editor until its Save button is pressed.
    const wanted=new Set(job.names.map(nameKey));
    const rows=page.locator('.memberlist.match li.player');
    for(let i=await rows.count()-1;i>=0;i--){
      const row=rows.nth(i),name=clean(await row.locator('.attending-fullname').innerText());
      if(!wanted.has(nameKey(name))) await row.locator('i.fa-minus-circle').first().click();
    }
    for(const name of job.names.filter(n=>!current.some(c=>nameKey(c)===nameKey(n)))) {
      let found=false;
      // Loans are limited to the teams used in BSK's selection UI.
      for(const label of ['F2014-Gul','F2014-Grön','F2015-Gul','F2015-Grön']) {
        const teamSelect=page.locator('select').first();
        if(await teamSelect.locator('option').filter({hasText:label}).count()!==1) continue;
        await teamSelect.selectOption({label});
        const candidates=page.locator('#choose-view li.player:visible');
        await page.waitForFunction(()=>!document.querySelector('#choose-view .spinner-container')?.checkVisibility());
        const labels=await candidates.locator('label').allTextContents();
        const matches=labels.map((n,i)=>({name:clean(n.replace(/\d+ år\s*$/,'' ).replace(/^\s*-\s*/,'')),i})).filter(n=>nameKey(n.name)===nameKey(name));
        if(matches.length>1) throw new Error('Tvetydig spelarkoppling');
        if(matches.length===1){await candidates.nth(matches[0].i).locator('input[type="checkbox"]').check();await page.getByRole('button',{name:/^Lägg till\b/}).click();found=true;break;}
      }
      if(!found) throw new Error('Spelaren finns inte entydigt i Svenska Lag');
    }
    const edited=(await page.locator('.memberlist.match li.player .attending-fullname').allTextContents()).map(clean);
    if(!sameLineup(edited,job.names)) throw new Error('Laguttagningen stämmer inte');
    // Re-read in a second page immediately before saving to detect changes made in Svenska Lag.
    const check=await context.newPage();
    try {if(!sameLineup(await readLineup(check,job.sourceId),current)||await check.evaluate(()=>JSON.stringify((window as unknown as {initData:{teamPresenceGroups:unknown[]}}).initData.teamPresenceGroups))!==originalGroups) return 'conflict';} finally{await check.close();}
    await beforeWrite();
    let used=false;
    const allowSave=async (route:import('playwright').Route)=>{
      const request=route.request(),url=new URL(request.url());
      if(!used&&request.method()==='POST'&&url.origin===ORIGIN&&url.pathname===`${TEAM_PATH}/controlpanel/presence/savepresence`&&url.searchParams.get('scheduleid')===job.sourceId){used=true;await saveRequest(route);}
      else await route.fallback();
    };
    await context.route('**/*',allowSave);
    try {
      const [response]=await Promise.all([
        page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname===`${TEAM_PATH}/controlpanel/presence/savepresence`),
        page.locator('input[type="button"][value="Spara"]').click(),
      ]);
      if(!response.ok()||!(await response.json()).isSuccess) throw new Error('Sparandet kunde inte verifieras');
    } finally {await context.unroute('**/*',allowSave);}
    const verify=await context.newPage();
    try {if(!sameLineup(await readLineup(verify,job.sourceId),job.names)) throw new Error('Återläsningen stämmer inte');} finally{await verify.close();}
    return 'ok';
  } finally {await page.close();}
}
