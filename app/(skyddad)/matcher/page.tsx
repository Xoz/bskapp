import Link from "next/link";
import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getMatches, type Match as MatchType } from "@/lib/queries";
import { level as levelInfo, LEVELS } from "@/lib/levels";
import { setMatchLevel } from "@/lib/actions";
import { IconPitch } from "@/components/Icons";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  seriespel: "Sammandrag",
  cup: "Cup",
  traningsmatch: "Träningsmatch",
};

export default async function MatchesPage() {
  const role = await getRole();
  if (!role) redirect("/login");

  const matches = await getMatches();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow">Säsongen</p>
          <h1 className="text-[1.7rem] font-bold mt-0.5">Matcher</h1>
          <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
            {matches.length} {matches.length === 1 ? "match registrerad" : "matcher registrerade"}
          </p>
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="card p-10 text-center">
          <span
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
          >
            <IconPitch width={22} height={22} />
          </span>
          <p className="font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>
            Inga matcher ännu
          </p>
          {role === "coach" ? (
            <>
              <p className="text-sm mb-5 max-w-sm mx-auto" style={{ color: "var(--ink-soft)" }}>
                Koppla lagets kalender eller lägg till matcher manuellt under Inställningar.
              </p>
              <Link href="/installningar" className="btn-secondary">Till Inställningar</Link>
            </>
          ) : (
            <p className="text-sm max-w-sm mx-auto" style={{ color: "var(--ink-soft)" }}>
              Tränaren har inte lagt in några matcher ännu.
            </p>
          )}
        </div>
      ) : (
        <MatchSections matches={matches} role={role} />
      )}

      <p className="text-xs max-w-xl" style={{ color: "var(--ink-faint)" }}>
        Enligt SvFF:s riktlinjer ligger fokus i barnfotbollen på utveckling – inte på resultat och
        tabeller. Resultatet är frivilligt att fylla i.
      </p>
    </div>
  );
}

function MatchCard({ m, role, today }: { m: MatchType; role: string; today: string }) {
  const hasResult = m.our_score != null && m.opponent_score != null;
  return (
    <Link href={`/matcher/${m.id}`} className="card card-hover p-5 flex items-center gap-4">
      <div
        className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
        style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
      >
        <IconPitch width={20} height={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate" style={{ fontFamily: "var(--font-display)" }}>
          {m.home_away === "home" ? "Hemma mot" : "Borta mot"} {m.opponent}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
          {m.date}
        </p>
      </div>
      {m.date === today && (
        <span className="badge" style={{ background: "var(--accent)", color: "var(--primary-deep)" }}>
          I dag
        </span>
      )}
      {(() => {
        const ml = levelInfo(m.level);
        return ml ? (
          <span className="badge inline-flex" style={{ background: "var(--bg2)", color: ml.color }}>
            {ml.label}
          </span>
        ) : null;
      })()}
      <span className="badge hidden sm:inline-flex" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
        {TYPE_LABELS[m.match_type] ?? m.match_type}
      </span>
      <span
        className="stat-number text-lg w-16 text-right"
        style={{ color: hasResult ? "var(--ink)" : "var(--ink-faint)" }}
      >
        {hasResult ? `${m.our_score}–${m.opponent_score}` : "–"}
      </span>
    </Link>
  );
}

// En post i listan: antingen en enskild match eller en grupp av cupmatcher
type Entry =
  | { kind: "match"; key: string; m: MatchType; sortDate: string; lastDate: string }
  | { kind: "cup"; key: string; name: string; matches: MatchType[]; sortDate: string; lastDate: string };

function buildEntries(matches: MatchType[]): Entry[] {
  const cups = new Map<string, MatchType[]>();
  const entries: Entry[] = [];
  for (const m of matches) {
    if (m.cup_name) {
      if (!cups.has(m.cup_name)) cups.set(m.cup_name, []);
      cups.get(m.cup_name)!.push(m);
    } else {
      entries.push({ kind: "match", key: `m${m.id}`, m, sortDate: m.date, lastDate: m.date });
    }
  }
  for (const [name, ms] of cups) {
    const sorted = [...ms].sort((a, b) => a.date.localeCompare(b.date) || (a.start_time ?? "").localeCompare(b.start_time ?? ""));
    entries.push({
      kind: "cup",
      key: `cup:${name}`,
      name,
      matches: sorted,
      sortDate: sorted[0].date,
      lastDate: sorted[sorted.length - 1].date,
    });
  }
  return entries;
}

function CupCard({ name, matches, today, role }: { name: string; matches: MatchType[]; today: string; role: string }) {
  const first = matches[0].date;
  const last = matches[matches.length - 1].date;
  const range = first === last ? first : `${first} – ${last}`;
  const ongoing = matches.some((m) => m.date === today);
  const played = matches.filter((m) => m.our_score != null && m.opponent_score != null).length;
  // Cupens nivå – matcherna delar nivå; ta den första som har en satt
  const cupLevel = levelInfo(matches.find((m) => m.level)?.level);

  return (
    <details className="card overflow-hidden" open={ongoing}>
      <summary className="p-5 flex items-center gap-4 cursor-pointer list-none">
        <div
          className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--accent)", color: "var(--primary-deep)" }}
        >
          🏆
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate" style={{ fontFamily: "var(--font-display)" }}>{name}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
            {range} · {matches.length} matcher{played > 0 ? ` · ${played} spelade` : ""}
          </p>
        </div>
        {ongoing && (
          <span className="badge" style={{ background: "var(--accent)", color: "var(--primary-deep)" }}>I dag</span>
        )}
        {cupLevel && (
          <span className="badge inline-flex" style={{ background: "var(--bg2)", color: cupLevel.color }}>{cupLevel.label}</span>
        )}
        <span className="badge hidden sm:inline-flex" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>Cup</span>
      </summary>
      {role === "coach" && (
        <form action={setMatchLevel} className="flex items-end gap-3 px-5 py-3 flex-wrap" style={{ borderTop: "1px solid var(--line)", background: "var(--primary-ghost)" }}>
          <input type="hidden" name="id" value={matches[0].id} />
          <input type="hidden" name="apply_cup" value="on" />
          <div className="flex-1 min-w-44">
            <label className="label" htmlFor={`cuplevel-${matches[0].id}`}>Cupens nivå</label>
            <select id={`cuplevel-${matches[0].id}`} name="level" defaultValue={cupLevel?.id ?? ""} className="input">
              <option value="">Ej satt</option>
              {LEVELS.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-secondary">Spara nivå</button>
        </form>
      )}
      <div style={{ borderTop: "1px solid var(--line)" }}>
        {matches.map((m) => {
          const hasResult = m.our_score != null && m.opponent_score != null;
          return (
            <Link
              key={m.id}
              href={`/matcher/${m.id}`}
              className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--primary-ghost)]"
              style={{ borderTop: "1px solid var(--line)" }}
            >
              <span className="text-sm flex-1 min-w-0">
                <span className="font-medium">{m.home_away === "home" ? "Hemma mot" : "Borta mot"} {m.opponent}</span>
                <span className="block text-xs" style={{ color: "var(--ink-faint)" }}>
                  {m.date}{m.start_time ? ` · ${m.start_time}` : ""}
                </span>
              </span>
              {m.date === today && (
                <span className="badge" style={{ background: "var(--accent)", color: "var(--primary-deep)" }}>I dag</span>
              )}
              <span className="stat-number text-base w-14 text-right" style={{ color: hasResult ? "var(--ink)" : "var(--ink-faint)" }}>
                {hasResult ? `${m.our_score}–${m.opponent_score}` : "–"}
              </span>
            </Link>
          );
        })}
      </div>
    </details>
  );
}

function EntryView({ entry, role, today }: { entry: Entry; role: string; today: string }) {
  if (entry.kind === "cup") {
    return <CupCard name={entry.name} matches={entry.matches} today={today} role={role} />;
  }
  return <MatchCard m={entry.m} role={role} today={today} />;
}

function MatchSections({ matches, role }: { matches: MatchType[]; role: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const entries = buildEntries(matches);
  // En cup räknas som kommande så länge dess sista dag inte passerat
  const upcoming = entries
    .filter((e) => e.lastDate >= today)
    .sort((a, b) => a.sortDate.localeCompare(b.sortDate));
  const past = entries
    .filter((e) => e.lastDate < today)
    .sort((a, b) => b.sortDate.localeCompare(a.sortDate));

  const countMatches = (es: Entry[]) =>
    es.reduce((n, e) => n + (e.kind === "cup" ? e.matches.length : 1), 0);

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-baseline gap-2.5 mb-3">
          <h2 className="font-semibold text-[1.05rem]">Kommande</h2>
          <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
            {countMatches(upcoming)} matcher
          </span>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm card p-5" style={{ color: "var(--ink-soft)" }}>
            Inga kommande matcher – hämta från kalendern under Inställningar när nya matcher
            planerats.
          </p>
        ) : (
          <div className="grid gap-3">
            {upcoming.map((e) => (
              <EntryView key={e.key} entry={e} role={role} today={today} />
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <div className="flex items-baseline gap-2.5 mb-3">
            <h2 className="font-semibold text-[1.05rem]">Spelade</h2>
            <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
              {countMatches(past)} matcher
            </span>
          </div>
          <div className="grid gap-3">
            {past.map((e) => (
              <EntryView key={e.key} entry={e} role={role} today={today} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
