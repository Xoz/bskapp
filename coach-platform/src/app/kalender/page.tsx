import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { listSessions } from "@/repositories/postgres";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"];
const MONTHS = ["Januari", "Februari", "Mars", "April", "Maj", "Juni", "Juli", "Augusti", "September", "Oktober", "November", "December"];
const STATUS_TONE: Record<string, "green" | "blue" | "amber"> = { draft: "amber", planned: "blue", completed: "green" };
const STATUS_LABEL: Record<string, string> = { draft: "Utkast", planned: "Planerat", completed: "Genomfört" };

const pad = (n: number) => String(n).padStart(2, "0");
const svKey = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" }); // YYYY-MM-DD
const addDays = (key: string, n: number) => { const d = new Date(key + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const weekdayMon = (key: string) => (new Date(key + "T00:00:00Z").getUTCDay() + 6) % 7; // måndag=0

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const todayKey = svKey(new Date());
  let year: number, month: number;
  if (m && /^\d{4}-\d{2}$/.test(m)) { year = Number(m.slice(0, 4)); month = Number(m.slice(5, 7)); }
  else { const [y, mo] = todayKey.split("-"); year = Number(y); month = Number(mo); }
  const inRange = (k: string) => k.startsWith(`${year}-${pad(month)}-`);
  const prev = addDays(`${year}-${pad(month)}-01`, -1).slice(0, 7);
  const next = addDays(`${year}-${pad(month)}-28`, 4).slice(0, 7); // ett datum i nästa månad → YYYY-MM

  const sessions = (await listSessions()).filter(s => {
    const k = svKey(new Date(s.startsAt));
    return k.startsWith(`${year}-${pad(month)}-`);
  });
  const byDay = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const k = svKey(new Date(s.startsAt));
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(s);
  }

  const monthStart = `${year}-${pad(month)}-01`;
  const gridStart = addDays(monthStart, -weekdayMon(monthStart));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  return <div className="page"><PageHeader eyebrow={`${MONTHS[(month - 1) % 12]} ${year}`} title="Kalender">
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <Link className="button" href={`/kalender?m=${prev}`}>← Förra</Link>
      <Link className="button" href="/kalender">Idag</Link>
      <Link className="button" href={`/kalender?m=${next}`}>Nästa →</Link>
      <Link className="button" href="/traningspass">Lista</Link>
    </div>
  </PageHeader>
    <Card title="Månadsvy" meta={`${sessions.length} pass denna månad`}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "1px", background: "var(--line)", borderRadius: 10, overflow: "hidden" }}>
        {WEEKDAYS.map(d => <div key={d} style={{ padding: "8px 6px", background: "var(--bg2)", fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{d.slice(0, 3)}</div>)}
        {cells.map(key => {
          const inMonth = inRange(key);
          const isToday = key === todayKey;
          const daySessions = byDay.get(key) ?? [];
          return <div key={key} style={{ minHeight: 84, padding: 6, background: inMonth ? "var(--bg)" : "var(--bg2)", borderTop: isToday ? "2px solid var(--blue)" : "none" }}>
            <div style={{ fontSize: 12, color: inMonth ? "var(--muted)" : "var(--line-2)", fontWeight: isToday ? 700 : 400, marginBottom: 4 }}>{Number(key.slice(8))}</div>
            <div className="stack" style={{ gap: 4 }}>
              {daySessions.map(s => <Link key={s.id} href={`/traningspass/${s.id}`} style={{ display: "block", padding: "4px 6px", borderRadius: 6, background: "var(--bg2)", fontSize: 11, lineHeight: 1.3, borderLeft: `3px solid var(--${STATUS_TONE[s.status] === "green" ? "green" : STATUS_TONE[s.status] === "blue" ? "blue" : "amber"})` }}>
                <b>{new Date(s.startsAt).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Stockholm" })}</b>
                <div style={{ color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
              </Link>)}
            </div>
          </div>;
        })}
      </div>
    </Card>
    <div className="tags" style={{ marginTop: 12, gap: 16 }}>
      {Object.entries(STATUS_LABEL).map(([k, label]) => <span key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}><Badge tone={STATUS_TONE[k]}>{label}</Badge></span>)}
    </div>
  </div>;
}