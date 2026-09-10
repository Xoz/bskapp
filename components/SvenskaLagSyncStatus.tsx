import { getSetting } from "@/lib/db";
import { hasPermission } from "@/lib/auth";
import { requestSvenskaLagSync } from "@/lib/svenskalag/actions";
import { STATUS_KEY, REQUEST_KEY, HISTORY_KEY, type SyncStatus } from "@/lib/svenskalag/model";
const dateLabel = (value:string) => new Date(value).toLocaleString("sv-SE",{timeZone:"Europe/Stockholm", dateStyle:"short",timeStyle:"short"});
export default async function SvenskaLagSyncStatus() {
  if (!(await hasPermission("manage_settings"))) return null;
  const [raw, request, historyRaw] = await Promise.all([getSetting(STATUS_KEY),getSetting(REQUEST_KEY),getSetting(HISTORY_KEY)]);
  const status: SyncStatus | null = raw ? JSON.parse(raw) : null;
  const history: SyncStatus[] = historyRaw ? JSON.parse(historyRaw) : [];
  const stale = status?.state === "running" && Date.now()-Date.parse(status.startedAt)>20*60_000;
  return <section id="svenskalag-synk" className="card p-6 space-y-4">
    <div><p className="core-kicker">Lag Gul</p><h2 className="font-semibold mt-2">Svenska Lag</h2></div>
    <p>{stale ? "Senaste hämtningen avbröts. Tidigare data ligger kvar." : status?.message ?? "Automatisk hämtning är inte ansluten ännu."}</p>
    <p className="body-small" style={{color:"var(--ink-secondary)"}}>Kallelser, svar och registrerad närvaro hämtas direkt. Dina uttagningsbeslut ändras inte.</p>
    {status?.lastSuccess && <p className="caption">Senast uppdaterat: {dateLabel(status.lastSuccess)}</p>}
    {status?.unmatched?.length ? <details><summary className="cursor-pointer">{status.unmatched.length} kopplingar att granska</summary><ul className="mt-2">{status.unmatched.map((text,i)=><li key={i}>{text}</li>)}</ul></details> : null}
    {request ? <p role="status">Hämtning beställd. Arbetaren kontrollerar kön varje minut.</p> : <form action={requestSvenskaLagSync}><button className="btn-secondary" disabled={!status || (status.state==="running" && !stale)}>Hämta nu</button></form>}
    {history.length>0 && <details><summary className="cursor-pointer">Senaste hämtningar</summary><ul className="space-y-2 mt-3">{history.map((item,i)=><li key={i} className="body-small">{dateLabel(item.startedAt)} · {item.message}{item.activities != null ? ` · ${item.activities} aktiviteter` : ""}</li>)}</ul></details>}
  </section>;
}
