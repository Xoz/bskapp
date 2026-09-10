import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import type postgres from 'postgres';
import {auditMatches} from './audit-matches';
async function main() {
  const browser=await chromium.launch();
  try {
    for(const scenario of ['removed','still-exists','calendar-fails','logged-out','listed'] as const) {
      const updates:string[]=[];
      const query=Object.assign(async(strings:TemplateStringsArray)=>{
        const text=strings.join('?');
        if(text.includes('SELECT m.id,m.date')) return [{id:7,date:'2026-09-12',start_time:'09:00',external_uid:'cal123-40600@svenskalag.se',external_key:null}];
        if(text.includes('SELECT m.id FROM matches')) return [{id:7}];
        if(text.includes('UPDATE matches')) updates.push(text);
        return [];
      },{begin:async(fn:(tx:unknown)=>unknown)=>fn(query)});
      const context=await browser.newContext();
      await context.route('**/*',route=>{
        const calendar=route.request().url().includes('/kalender/');
        let body=scenario==='logged-out'?'<input type="password">':'<div id="logged-in-menu"></div>';
        if(calendar) body+='<table id="table-schedule">'+(scenario==='listed'&&route.request().url().endsWith('/september')?'<tr><td><b>12</b></td><td>09:00</td><td><a href="/bollstanassk-fotboll-f2014-gul/match/123/test">Match</a></td></tr>':'')+'</table>';
        else body+=scenario==='removed'?'<h1>Aktiviteten är borttagen</h1>':'<h1>En match som fortfarande finns</h1>';
        return route.fulfill({status:scenario==='calendar-fails'?503:200,body,contentType:'text/html; charset=utf-8'});
      });
      if(scenario==='calendar-fails'||scenario==='logged-out') await assert.rejects(auditMatches(query as unknown as ReturnType<typeof postgres>,context,'2026-09-10'));
      else {
        const result=await auditMatches(query as unknown as ReturnType<typeof postgres>,context,'2026-09-10');
        assert.deepEqual(result.removed,scenario==='removed'?[7]:[]);
        assert.equal(result.warnings.length,scenario==='still-exists'?1:0);
      }
      assert.equal(updates.length,scenario==='removed'?1:0);
      await context.close();
    }
    console.log('Matchkontroll: bekräftad borttagning, befintlig match, läsfel, utloggning och kalenderträff verifierade.');
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
