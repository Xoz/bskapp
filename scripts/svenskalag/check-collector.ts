import { chromium } from "playwright";
import assert from "node:assert/strict";
import {collect} from "./collect";
import {ORIGIN,TEAM_PATH} from "../../lib/svenskalag/model";
async function main() {
  const browser=await chromium.launch();
  try {
    for (const broken of [false,true]) {
      const context=await browser.newContext();
      await context.route('**/*', async route=>{
        const path=new URL(route.request().url()).pathname;
        let body='<ul id="logged-in-menu"></ul><input type="password" style="display:none">';
        if(path.includes('/kalender/')) {
          body+='<table id="table-schedule">';
          if(path.endsWith('/september')) for(const [i,id] of ['123','456'].entries()) body+=`<tr><td>${i===0?'<b>9</b>':''}</td><td>09:00</td><td><a href="${ORIGIN}${TEAM_PATH}/match/${id}/test"><span class="activity-name">Testmatch</span></a></td></tr>`;
          body+='</table>';
        } else if(path.endsWith('/kontrollpanelen/aktiviteter')) body+=`<table><tr id="ScheduleRow123_"><td><span title="Närvaro sparad av Test"></span><a title="Fyll i närvaro" onclick="popit('${TEAM_PATH}/controlpanel/presence/chooseparticipants/123')">2</a></td></tr></table>`;
        else if(path.includes('/controlpanel/presence/')) body+='<ul class="split-tab"><li>Grupp A</li><li>+</li></ul><div class="memberlist"><li class="player"><div class="left">Ej närvarande</div></li></div><div class="memberlist"><li class="leader presence-row">Ledare</li><li class="player presence-row"><div class="left">9. Exempel A</div></li></div>';
        else {body+='<h3 class="game-header">Bollstanäs SK 3 - Testlag</h3>'; for (const [panel,label,name] of [['tabYes','Kommer','Exempel A'],['tabNo','Kan ej','Exempel B'],['tabNoAnswer','Kallade','Exempel C']]) body+=`<a data-target="#${panel}" href="#${panel}">${label}${broken?2:1}+0</a><div id="${panel}"><a class="delete-from-list" membertypeid="1" name="${name}">Spelare</a></div>`;
        }
        await route.fulfill({contentType:'text/html; charset=utf-8',body});
      });
      if(broken) await assert.rejects(collect(context,'2026-09-10'),/svarslistan/);
      else {
        const rows=await collect(context,'2026-09-10');
        assert.equal(rows.length,2);assert.equal(rows[1].date,'2026-09-09');
        assert.equal(rows[0].callups.length,3);assert.deepEqual(rows[0].attendance,['Exempel A']);assert.equal(rows[1].attendance,null);
      }
      await context.close();
    }
    console.log('Playwright: komplett lista, alla svarslägen, flera matcher samma dag och ofullständig lista verifierade.');
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
