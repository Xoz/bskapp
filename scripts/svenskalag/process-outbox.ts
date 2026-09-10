import {swedishWallClockToEpoch} from '../../lib/dates';
import type postgres from 'postgres';
import type {BrowserContext} from 'playwright';
import type {ActivitySnapshot} from '../../lib/svenskalag/model';
import {outboxKey,draftKey,publicationDecision,sameLineup,type LineupJob} from '../../lib/svenskalag/outbox';
import {publishLineup} from './lineup';
export async function processOutbox(sql:ReturnType<typeof postgres>,context:BrowserContext,snapshot:ActivitySnapshot[],today:string) {
  const pending=await sql`SELECT value FROM settings WHERE key LIKE 'svenskalag_outbox:%' AND value::jsonb->>'state' IN ('queued','running') ORDER BY key LIMIT 10`;
  for(const row of pending) {
    let job:LineupJob=JSON.parse(row.value);
    if(!Number.isSafeInteger(job.matchId)||job.matchId<=0) continue;
    const lock=await sql.reserve();
    try {
      await lock`SELECT pg_advisory_lock(2014,${job.matchId})`;
      const fresh=(await sql`SELECT value FROM settings WHERE key=${outboxKey(job.matchId)}`)[0];
      if(!fresh||JSON.parse(fresh.value).id!==job.id) continue;
      job=JSON.parse(fresh.value);
      const write=async()=>{await sql`UPDATE settings SET value=${JSON.stringify(job)} WHERE key=${outboxKey(job.matchId)} AND value::jsonb->>'id'=${job.id}`;};
      try {
        const source=snapshot.find(a=>a.kind==='match'&&a.sourceId===job.sourceId);
        const match=(await sql`SELECT m.id,m.date FROM matches m JOIN groups g ON g.id=m.group_id WHERE m.id=${job.matchId} AND m.external_uid=${`sanktan:${job.sourceId}`} AND g.name='Gul' AND g.active=1`)[0];
        const selected=(await sql`SELECT p.name FROM match_roster r JOIN players p ON p.id=r.player_id WHERE r.match_id=${job.matchId} AND r.selection_status='selected' AND p.active=1`).map(p=>p.name as string);
        if(!source||source.cancelled||!source.lineup||swedishWallClockToEpoch(source.date,source.time)<=Date.now()||source.date!==job.date||job.date<today||!match||match.date!==job.date||!sameLineup(selected,job.names)||publicationDecision(source.lineup,job)==='conflict') {
          job.state='conflict';job.message='Uttagningen eller matchen har ändrats. Kontrollera och skicka på nytt.';
        } else {
          const outcome=await publishLineup(context,job,async()=>{job.state='running';job.message='Överför laguppställningen till Svenska Lag';await write();});
          job.state=outcome;
          job.message=outcome==='ok'?'Laguppställningen är verifierad i Svenska Lag. Öppna matchen där för att kalla spelarna.':'Laguppställningen ändrades i Svenska Lag. Kontrollera och skicka på nytt.';
          if(outcome==='ok') await sql.begin(async tx=>{
            await tx`DELETE FROM settings WHERE key=${draftKey(job.matchId)}`;
            await tx`UPDATE match_roster SET source='svenskalag_browser' WHERE match_id=${job.matchId} AND selection_status='selected'`;
          });
        }
      } catch {
        job.state='error';job.message='Överföringen kunde inte bekräftas. Kontrollera laguppställningen i Svenska Lag innan du skickar på nytt.';
      }
      job.finishedAt=new Date().toISOString();await write();
    } finally {await lock`SELECT pg_advisory_unlock(2014,${job.matchId})`;lock.release();}
  }
}
