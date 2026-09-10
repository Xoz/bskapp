import {auditMatches} from "./audit-matches";
import { chromium } from "playwright";
import postgres from "postgres";
import { authenticatedContext } from "./auth";
import {processOutbox} from "./process-outbox";
import { collect, LoginRequired } from "./collect";
import { applySnapshot } from "../../lib/svenskalag/import";
import { STATUS_KEY, GREEN_STATUS_KEY, REQUEST_KEY, HISTORY_KEY, type SyncStatus } from "../../lib/svenskalag/model";

process.umask(0o077);
async function main() {
  if (!process.env.DATABASE_URL || !process.env.SVENSKALAG_STATE_FILE) throw new Error("Synkens miljö är inte konfigurerad");
  const sql = postgres(process.env.DATABASE_URL, {max:3, prepare:false, connection:{application_name:"bsk-svenskalag-sync"}});
  const lock = await sql.reserve();
  let locked = false;
  try {
    const result = await lock`SELECT pg_try_advisory_lock(2014, 910) AS locked`;
    locked = result[0].locked;
    if (!locked) return;
    const read = async (key:string) => (await sql`SELECT value FROM settings WHERE key = ${key}`)[0]?.value;
    const write = async (key:string, value:unknown) => {await sql`INSERT INTO settings (key,value) VALUES (${key},${JSON.stringify(value)}) ON CONFLICT(key) DO UPDATE SET value = excluded.value`;};
    const previous: SyncStatus | null = JSON.parse(await read(STATUS_KEY) || "null");
    const request = await read(REQUEST_KEY);
    const outbound=(await sql`SELECT key FROM settings WHERE key LIKE 'svenskalag_outbox:%' AND value::jsonb->>'state' IN ('queued','running') LIMIT 1`).length>0;
    const now = new Date();
    const today = now.toLocaleDateString("sv-SE",{timeZone:"Europe/Stockholm"});
    const hour = Number(now.toLocaleTimeString("sv-SE",{timeZone:"Europe/Stockholm", hour:"2-digit",hour12:false}));
    if (!process.argv.includes("--now") && !request && !outbound) {
      if (hour < 6 || hour > 22) { if (hour !== 3) return; }
      if (previous && now.getTime() - Date.parse(previous.startedAt) < 55*60_000) return;
    }
    if (request) await sql`DELETE FROM settings WHERE key = ${REQUEST_KEY} AND value = ${request}`;
    const status: SyncStatus = {state:"running", startedAt:now.toISOString(), lastSuccess:previous?.lastSuccess, message:"Hämtar från Svenska Lag"};
    await write(STATUS_KEY,status);
    let finished = false;
    for (let attempt=0; attempt<3 && !finished; attempt++) {
      let browser;
      try {
        browser = await chromium.launch({headless:true,args:["--disable-features=BackForwardCache","--renderer-process-limit=2"]});
        const context = await authenticatedContext(browser,process.env.SVENSKALAG_STATE_FILE,{username:process.env.SVENSKALAG_USERNAME,password:process.env.SVENSKALAG_PASSWORD});
        const snapshot = await collect(context,today);
        const imported = await applySnapshot(sql,snapshot,today,process.argv.includes("--dry-run"));
        const audit=await auditMatches(sql,context,today,process.argv.includes("--dry-run"));
        await write("svenskalag_match_audit",{...audit,checkedAt:new Date().toISOString()});
        imported.unmatched.push(...audit.warnings);
        // Grön läses enbart som underlag för spelarnas gemensamma belastning.
        // Fel där stoppar inte Guls ordinarie synk eller skriver över gamla Grön-data.
        const greenPrevious: SyncStatus | null = JSON.parse(await read(GREEN_STATUS_KEY) || "null");
        const greenStatus: SyncStatus = {state:"running",startedAt:new Date().toISOString(),lastSuccess:greenPrevious?.lastSuccess,message:"Hämtar Gröns matcher"};
        if (!process.argv.includes("--dry-run")) await write(GREEN_STATUS_KEY,greenStatus);
        try {
          const green = await collect(context,today,"Grön");
          const greenImported = await applySnapshot(sql,green,today,process.argv.includes("--dry-run"),"Grön");
          const greenAudit = await auditMatches(sql,context,today,process.argv.includes("--dry-run"),"Grön");
          greenStatus.state="ok"; greenStatus.activities=greenImported.activities;
          greenStatus.unmatched=[...greenImported.unmatched,...greenAudit.warnings];
          greenStatus.message="Gröns matcher, svar och registrerade deltagande är kontrollerade";
          if (!process.argv.includes("--dry-run")) greenStatus.lastSuccess=new Date().toISOString();
        } catch(error) {
          greenStatus.state=error instanceof LoginRequired ? "login_required" : "error";
          greenStatus.message="Gröns matchunderlag kunde inte verifieras. Tidigare uppgifter behålls.";
          imported.unmatched.push("Grön: matchunderlaget kunde inte uppdateras");
        }
        greenStatus.finishedAt=new Date().toISOString();
        if (!process.argv.includes("--dry-run")) await write(GREEN_STATUS_KEY,greenStatus);
        if(!process.argv.includes("--dry-run")&&outbound) await processOutbox(sql,context,snapshot,today);
        status.state="ok"; status.activities=imported.activities; status.unmatched=imported.unmatched;
        status.message=process.argv.includes("--dry-run") ? "Provkörning klar, inget importerat" : "Svenska Lag är uppdaterat";
        if (!process.argv.includes("--dry-run")) status.lastSuccess=new Date().toISOString();
        finished=true;
      } catch(error) {
        status.state=error instanceof LoginRequired ? "login_required" : "error";
        status.message=error instanceof LoginRequired ? "Logga in på nytt för att återuppta synken" : "Hämtningen kunde inte verifieras. Tidigare data ligger kvar.";
        // Inga råa browserfel, sidinnehåll eller sessionsuppgifter i loggen.
        if (error instanceof LoginRequired) finished=true;
      } finally { await browser?.close(); }
      if (!finished && attempt<2) await new Promise(resolve=>setTimeout(resolve, (attempt+1)*5000));
    }
    status.finishedAt=new Date().toISOString();
    await write(STATUS_KEY,status);
    const history=JSON.parse(await read(HISTORY_KEY) || "[]");
    await write(HISTORY_KEY,[status,...history].slice(0,10));
    console.log(JSON.stringify({state:status.state,activities:status.activities ?? 0,unmatched:status.unmatched?.length ?? 0}));
    if (status.state!=="ok") process.exitCode=1;
  } finally {
    if (locked) await lock`SELECT pg_advisory_unlock(2014,910)`;
    lock.release();
    await sql.end({timeout:5});
  }
}
main().catch(()=>{console.error("Synken kunde inte starta; kontrollera konfiguration och databas.");process.exitCode=1;});
