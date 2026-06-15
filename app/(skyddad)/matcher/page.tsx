import Link from "next/link";
import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getMatches, cupMatchCompare, cupRoundLabel, matchTitle, type Match as MatchType } from "@/lib/queries";
import { swedishToday } from "@/lib/dates";
import { level as levelInfo } from "@/lib/levels";
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
        {role === "coach" && (
          <Link href="/matcher/ny-cup" className="btn-secondary text-sm">
            + Ny cup
          </Link>
        )}
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
  const isToday = m.date === today;
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <Link href={`/matcher/${m.id}`} className="card card-hover p-5 flex items-center gap-4 flex-1">
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
    {role === "parent" && isToday && (
      <Link
        href={`/matcher/${m.id}/live`}
        className="btn-primary sm:self-stretch flex items-center justify-center gap-2 sm:px-4"
      >
        📋 Rapportera
      </Link>
    )}
    </div>
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
    const sorted = [...ms].sort(cupMatchCompare);
    const byDate = [...ms].map((m) => m.date).sort();
    entries.push({
      kind: "cup",
      key: `cup:${name}`,
      name,
      matches: sorted,
      sortDate: byDate[0],
      lastDate: byDate[byDate.length - 1],
    });
  }
  return entries;
}

function CupCard({ name, matches, today, role }: { name: string; matches: MatchType[]; today: string; role: string }) {
  const first = matches[0].date;
  const last = matches[matches.length - 1].date;
  const range = first === last ? first : `${first} – ${last}`;
  const ongoing = matches.some((m) => m.date === today);
  const cupLevel = levelInfo(matches.find((m) => m.level)?.level);

  // Poängberäkning för gruppspelsmatcher med resultat
  const groupWithResult = matches.filter(
    (m) => m.cup_phase !== "playoff" && m.our_score != null && m.opponent_score != null
  );
  const wins = groupWithResult.filter((m) => m.our_score! > m.opponent_score!).length;
  const draws = groupWithResult.filter((m) => m.our_score! === m.opponent_score!).length;
  const losses = groupWithResult.filter((m) => m.our_score! < m.opponent_score!).length;
  const points = wins * 3 + draws;
  const goalsFor = groupWithResult.reduce((s, m) => s + m.our_score!, 0);
  const goalsAgainst = groupWithResult.reduce((s, m) => s + m.opponent_score!, 0);
  const hasGroupStats = groupWithResult.length > 0;

  const editHref = `/matcher/cup/${encodeURIComponent(name)}`;

  return (
    <details className="card overflow-hidden" open={ongoing}>
      <summary className="p-5 flex items-center gap-3 cursor-pointer list-none">
        <div
          className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--accent)", color: "var(--primary-deep)" }}
        >
          🏆
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate" style={{ fontFamily: "var(--font-display)" }}>{name}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
            {range} · {matches.length} matcher{groupWithResult.length > 0 ? ` · ${groupWithResult.length} spelade` : ""}
          </p>
        </div>
        {ongoing && (
          <span className="badge" style={{ background: "var(--accent)", color: "var(--primary-deep)" }}>I dag</span>
        )}
        {cupLevel && (
          <span className="badge inline-flex" style={{ background: "var(--bg2)", color: cupLevel.color }}>{cupLevel.label}</span>
        )}
        <span className="badge hidden sm:inline-flex" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>Cup</span>
        {role === "coach" && (
          <Link
            href={editHref}
            title="Redigera cup"
            className="shrink-0 text-lg leading-none px-1 rounded-lg transition-colors hover:bg-[var(--bg2)]"
            style={{ color: "var(--ink-faint)" }}
          >
            ···
          </Link>
        )}
      </summary>
      {/* Poängsammanställning gruppspel */}
      {hasGroupStats && (
        <div
          className="flex items-center gap-4 px-5 py-2.5"
          style={{ borderTop: "1px solid var(--line)", background: "var(--bg2)" }}
        >
          <span className="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>Poäng</span>
          <span className="stat-number text-base" style={{ color: "var(--primary)" }}>{points}</span>
          <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
            {wins}V {draws}O {losses}F
          </span>
          <span className="text-xs ml-auto" style={{ color: "var(--ink-faint)" }}>
            {goalsFor}–{goalsAgainst}
          </span>
        </div>
      )}
      <div>
        {matches.map((m) => {
          const hasResult = m.our_score != null && m.opponent_score != null;
          const roundLabel = cupRoundLabel(m);
          const title = matchTitle(m);
          // Visa rundan i undertexten om den inte redan är titeln.
          const showRoundInSub = roundLabel && roundLabel !== title;
          return (
            <Link
              key={m.id}
              href={`/matcher/${m.id}`}
              className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--primary-ghost)]"
              style={{ borderTop: "1px solid var(--line)" }}
            >
              <span className="text-sm flex-1 min-w-0">
                <span className="font-medium">{title}</span>
                <span className="block text-xs" style={{ color: "var(--ink-faint)" }}>
                  {m.date}{m.start_time ? ` · ${m.start_time}` : ""}
                  {showRoundInSub && ` · ${roundLabel}`}
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
  const today = swedishToday();
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
