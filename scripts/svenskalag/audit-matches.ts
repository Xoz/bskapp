import type {BrowserContext} from 'playwright';
import type postgres from 'postgres';
import {ORIGIN,TEAM_PATHS,type SyncTeam,sourceUrl} from '../../lib/svenskalag/model';
import {LoginRequired} from './collect';
import {applyRemovedMatches, type RemovedMatch} from '../../lib/svenskalag/removed-matches';

/** Kalendern är en inventering, aldrig ensam bevis för att radera en match. */
export async function auditMatches(sql:ReturnType<typeof postgres>,context:BrowserContext,today:string,dryRun=false,team:SyncTeam="Gul") {
  const teamPath=TEAM_PATHS[team];
  const year=today.slice(0,4);
  const rows=await sql`SELECT m.id,m.date,m.start_time,m.external_uid,m.cancelled,
    (SELECT da.external_key FROM development_activities da WHERE da.match_id=m.id LIMIT 1) AS external_key
    FROM matches m JOIN groups g ON g.id=m.group_id
    WHERE g.name=${team} AND g.group_type='subgroup' AND g.active=1 AND m.date LIKE ${year+'%'}
    AND m.source IN ('calendar','svenskalag_sanktan')`;
  const calendar=new Map<string,{date:string;time:string}>();
  const months=['januari','februari','mars','april','maj','juni','juli','augusti','september','oktober','november','december'];
  const page=await context.newPage();
  page.setDefaultTimeout(15000);
  const open=async(url:string)=>{
    const response=await page.goto(sourceUrl(url,teamPath),{waitUntil:'domcontentloaded',timeout:30000});
    if(!response?.ok()) throw new Error('Matchkontrollens källa svarar inte');
    sourceUrl(page.url(),teamPath);
    if(await page.locator('input[type="password"]').first().isVisible()||!(await page.locator('#logged-in-menu').count())) throw new LoginRequired();
  };
  const removed:RemovedMatch[]=[];
  const warnings:string[]=[];
  try {
    for(const [index,month] of months.entries()) {
      await open(`${ORIGIN}${teamPath}/kalender/${year}/${month}`);
      await page.locator('#table-schedule').waitFor({state:'attached'});
      const entries=await page.locator('#table-schedule tr').evaluateAll(rows=>{
        let day='';
        return rows.flatMap(row=>{
          const cells=row.querySelectorAll('td');day=cells[0]?.querySelector('b')?.textContent?.trim()||day;
          const link=row.querySelector<HTMLAnchorElement>('a[href*="/match/"],a[href*="/aktivitet/"]');
          return link?[{url:link.href,day,time:cells[1]?.textContent?.match(/\d{1,2}:\d{2}/)?.[0]??''}]:[];
        });
      });
      for(const entry of entries) {
        // Föreningsgemensamma aktiviteter kan visas i lagkalendern.
        const linked=new URL(entry.url);
        if(linked.origin!==ORIGIN||!linked.pathname.startsWith(teamPath+'/')) continue;
        const id=sourceUrl(entry.url,teamPath).match(/\/(?:match|aktivitet)\/(\d+)(?:\/|$)/)?.[1];
        const date=`${year}-${String(index+1).padStart(2,'0')}-${entry.day.padStart(2,'0')}`;
        if(!id||!/^\d{1,2}$/.test(entry.day)||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date) throw new Error('Ofullständig kalender');
        const value={date,time:entry.time.padStart(5,'0')};
        if(calendar.has(id)&&JSON.stringify(calendar.get(id))!==JSON.stringify(value)) throw new Error('Motstridiga kalenderposter');
        calendar.set(id,value);
      }
    }
    for(const row of rows) {
      const sourceId=String(row.external_key??'').match(/^sanktan:(\d+)$/)?.[1]??String(row.external_uid??'').match(/^(?:sanktan:|cal)(\d+)(?:-|$)/)?.[1];
      if(!sourceId) {warnings.push(`Match ${row.id}: källkoppling saknas`);continue;}
      const entry=calendar.get(sourceId);
      if(entry) {
        if(entry.date!==row.date||entry.time!==row.start_time) warnings.push(`Match ${row.id}: datum eller tid skiljer sig från Svenska Lag`);
        continue;
      }
      await open(`${ORIGIN}${teamPath}/match/${sourceId}`);
      // Svenska Lag returnerar HTTP 200 även för borttagna aktiviteter.
      if(await page.getByRole('heading',{name:'Aktiviteten är borttagen',exact:true}).count()===1) removed.push({matchId:row.id,sourceId,evidence:'source-deleted'});
      else warnings.push(`Match ${row.id}: saknas i kalendern men är inte bekräftat borttagen`);
    }
  } finally {await page.close();}
  await applyRemovedMatches(sql,removed,today,dryRun,team);
  return {checked:rows.length,removed:removed.map(r=>r.matchId),warnings};
}
