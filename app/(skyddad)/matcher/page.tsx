import Link from "next/link";
import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getMatches, getCupScorers, getCupFormLeaders, cupMatchCompare, cupRoundLabel, cupMootRounds, matchTitle, type Match as MatchType, type CupScorerRow, type CupFormRow } from "@/lib/queries";
import { swedishToday } from "@/lib/dates";
import { level as levelInfo } from "@/lib/levels";
import { IconPitch } from "@/components/Icons";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  seriespel: "Sanktan",
  cup: "Cup",
  traningsmatch: "Träningsmatch",
};

export default async function MatchesPage() {
  const role = await getRole();
  if (!role) redirect("/login");

  const [matches, cupScorers, cupForm] = await Promise.all([
    getMatches(),
    getCupScorers(),
    getCupFormLeaders(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow">Säsongen</p>
          <h1 className="mt-1" style={{ fontSize: "40px" }}>Matcher</h1>
          <p className="body-small mt-1" style={{ color: "var(--ink-secondary)" }}>
            {matches.length} {matches.length === 1 ? "match registrerad" : "matcher registrerade"}
          </p>
        </div>
        {role === "coach" && (
          <div className="flex gap-2.5 flex-wrap">
            <Link href="/matcher/importera-cup" className="btn-secondary btn-sm">
              Importera cup
            </Link>
            <Link href="/matcher/ny-cup" className="btn-secondary btn-sm">
              + Ny cup
            </Link>
          </div>
        )}
      </div>

      {matches.length === 0 ? (
        <EmptyState
          icon={<IconPitch width={22} height={22} />}
          title="Inga matcher ännu"
          body={role === "coach"
            ? "Koppla lagets kalender eller lägg till matcher manuellt under Inställningar."
            : "Tränaren har inte lagt in några matcher ännu."}
          action={role === "coach" ? <Link href="/installningar" className="btn-secondary">Till Inställningar</Link> : undefined}
        />
      ) : (
        <MatchSections matches={matches} role={role} cupScorers={cupScorers} cupForm={cupForm} />
      )}

      <p className="caption max-w-xl" style={{ color: "var(--ink-muted)" }}>
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
        <p className="font-semibold truncate body" style={{ fontFamily: "var(--font-display)" }}>
          {m.home_away === "home" ? "Hemma mot" : "Borta mot"} {m.opponent}
        </p>
        <p className="caption mt-0.5" style={{ color: "var(--ink-muted)" }}>
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
          <span className="badge level-tag inline-flex" data-level={ml.id} style={{ background: "var(--surface)" }}>
            {ml.label}
          </span>
        ) : null;
      })()}
      <span className="badge hidden sm:inline-flex" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
        {TYPE_LABELS[m.match_type] ?? m.match_type}
      </span>
      <span
        className="stat-number text-lg w-16 text-right"
        style={{ color: hasResult ? "var(--ink)" : "var(--ink-muted)" }}
      >
        {hasResult ? `${m.our_score}–${m.opponent_score}` : "–"}
      </span>
    </Link>
  );
}

// En post i listan: antingen en enskild match eller en grupp av cupmatcher.
// cup_name + cup_group är sammansatt nyckel – samma cup-namn i olika grupper är separata poster.
type Entry =
  | { kind: "match"; key: string; m: MatchType; sortDate: string; lastDate: string }
  | { kind: "cup"; key: string; name: string; cupGroup: string; matches: MatchType[]; sortDate: string; lastDate: string };

function buildEntries(matches: MatchType[]): Entry[] {
  const cups = new Map<string, MatchType[]>();
  const entries: Entry[] = [];
  for (const m of matches) {
    if (m.cup_name) {
      const compositeKey = m.cup_name + "\x01" + (m.cup_group ?? "");
      if (!cups.has(compositeKey)) cups.set(compositeKey, []);
      cups.get(compositeKey)!.push(m);
    } else {
      entries.push({ kind: "match", key: `m${m.id}`, m, sortDate: m.date, lastDate: m.date });
    }
  }
  for (const [compositeKey, ms] of cups) {
    const sorted = [...ms].sort(cupMatchCompare);
    const byDate = [...ms].map((m) => m.date).sort();
    const cupName = ms[0].cup_name;
    const cupGroup = ms[0].cup_group ?? "";
    entries.push({
      kind: "cup",
      key: `cup:${compositeKey}`,
      name: cupName,
      cupGroup,
      matches: sorted,
      sortDate: byDate[0],
      lastDate: byDate[byDate.length - 1],
    });
  }
  return entries;
}

// Lagets slutplacering i cupen utifrån slutspelsresultaten. Returnerar null så
// länge inget är avgjort (gruppspel pågår / slutspel ej spelat).
function cupPlacement(matches: MatchType[]): { emoji: string; label: string } | null {
  const done = (m: MatchType) => m.our_score != null && m.opponent_score != null;
  const won = (m: MatchType) => done(m) && m.our_score! > m.opponent_score!;
  const final = matches.find((m) => m.cup_round === "f" && done(m));
  if (final) return won(final) ? { emoji: "🥇", label: "Vinnare" } : { emoji: "🥈", label: "Tvåa" };
  const bronze = matches.find((m) => m.cup_round === "bronze" && done(m));
  if (bronze) return won(bronze) ? { emoji: "🥉", label: "Trea" } : { emoji: "", label: "Fyra" };
  const hasBronzeMatch = matches.some((m) => m.cup_round === "bronze");
  const lostSemi = matches.find((m) => m.cup_round === "sf" && done(m) && !won(m));
  if (lostSemi && !hasBronzeMatch) return { emoji: "", label: "Utslagen i semifinal" };
  const lostQf = matches.find((m) => m.cup_round === "qf" && done(m) && !won(m));
  if (lostQf) return { emoji: "", label: "Utslagen i kvartsfinal" };
  return null;
}

function CupCard({
  name,
  cupGroup,
  matches,
  today,
  role,
  scorers,
  formLeaders,
}: {
  name: string;
  cupGroup: string;
  matches: MatchType[];
  today: string;
  role: string;
  scorers: CupScorerRow[];
  formLeaders: CupFormRow[];
}) {
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
  const placement = cupPlacement(matches);
  const mootRounds = cupMootRounds(matches);

  const grupp = cupGroup ? `?grupp=${encodeURIComponent(cupGroup)}` : "";
  const editHref = `/matcher/cup/${encodeURIComponent(name)}${grupp}`;

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
          <p className="font-semibold truncate" style={{ fontFamily: "var(--font-display)" }}>
            {name}{cupGroup ? ` · ${cupGroup}` : ""}
          </p>
          <p className="caption mt-0.5" style={{ color: "var(--ink-muted)" }}>
            {range} · {matches.length} matcher{groupWithResult.length > 0 ? ` · ${groupWithResult.length} spelade` : ""}
          </p>
        </div>
        {placement && (
          <span
            className="badge inline-flex items-center gap-1"
            style={{ background: "var(--accent)", color: "var(--primary-deep)", fontWeight: 600 }}
          >
            {placement.emoji && <span>{placement.emoji}</span>}
            {placement.label}
          </span>
        )}
        {ongoing && (
          <span className="badge" style={{ background: "var(--accent)", color: "var(--primary-deep)" }}>I dag</span>
        )}
        {cupLevel && (
          <span className="badge level-tag inline-flex" data-level={cupLevel.id} style={{ background: "var(--surface)" }}>{cupLevel.label}</span>
        )}
        <span className="badge hidden sm:inline-flex" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>Cup</span>
        {role === "coach" && (
          <Link
            href={editHref}
            title="Redigera cup"
            className="shrink-0 text-lg leading-none px-1 rounded-lg transition-colors hover:bg-[var(--surface)]"
            style={{ color: "var(--ink-muted)" }}
          >
            ···
          </Link>
        )}
      </summary>
      {/* Poängsammanställning gruppspel */}
      {hasGroupStats && (
        <div
          className="flex items-center gap-4 px-5 py-2.5"
          style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}
        >
          <span className="caption font-semibold" style={{ color: "var(--ink-secondary)" }}>Poäng</span>
          <span className="stat-number text-base" style={{ color: "var(--primary)" }}>{points}</span>
          <span className="caption" style={{ color: "var(--ink-muted)" }}>
            {wins}V {draws}O {losses}F
          </span>
          <span className="caption ml-auto" style={{ color: "var(--ink-muted)" }}>
            {goalsFor}–{goalsAgainst}
          </span>
        </div>
      )}
      {/* Skyttar i cupen – spelarbidrag summerat över alla matcher */}
      {scorers.length > 0 && (
        <div className="px-5 py-3" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="caption font-semibold mb-2" style={{ color: "var(--ink-secondary)" }}>
            Skyttar i cupen
          </p>
          <div className="space-y-1.5">
            {scorers.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 min-w-0 truncate" style={{ color: "var(--ink)" }}>
                  {s.name.replace(/^Exempel:\s*/, "").split(" ")[0]}
                </span>
                {s.goals > 0 && (
                  <span className="shrink-0" style={{ color: "var(--ink-secondary)" }}>
                    <span className="stat-number" style={{ color: "var(--primary)" }}>{s.goals}</span> mål
                  </span>
                )}
                {s.assists > 0 && (
                  <span className="shrink-0 text-xs" style={{ color: "var(--ink-muted)" }}>
                    {s.goals > 0 ? "· " : ""}<span className="stat-number">{s.assists}</span> assist
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Bästa form i cupen – störst uppgång i matchbetygens form (nivåjusterat) */}
      {formLeaders.length > 0 && (
        <div className="px-5 py-3" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="caption font-semibold mb-2" style={{ color: "var(--ink-secondary)" }}>
            Bästa form i cupen
          </p>
          <div className="space-y-1.5">
            {formLeaders.slice(0, 3).map((f) => (
              <div key={f.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 min-w-0 truncate" style={{ color: "var(--ink)" }}>
                  {f.name.replace(/^Exempel:\s*/, "").split(" ")[0]}
                </span>
                <span className="shrink-0 text-xs" style={{ color: "var(--ink-muted)" }}>
                  <span className="stat-number" style={{ color: "var(--primary)" }}>+{f.form_delta}</span> form
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        {matches.map((m) => {
          const hasResult = m.our_score != null && m.opponent_score != null;
          const roundLabel = cupRoundLabel(m);
          const title = matchTitle(m);
          // Visa rundan i undertexten om den inte redan är titeln.
          const showRoundInSub = roundLabel && roundLabel !== title;
          // Oslagen slutspelsmatch som laget inte längre spelar (utslaget).
          const isMoot = !hasResult && m.cup_phase === "playoff" && !!m.cup_round && mootRounds.has(m.cup_round);
          return (
            <Link
              key={m.id}
              href={`/matcher/${m.id}`}
              className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--primary-ghost)]"
              style={{ borderTop: "1px solid var(--border)", opacity: isMoot ? 0.55 : 1 }}
            >
              <span className="body-small flex-1 min-w-0">
                <span className="font-medium" style={isMoot ? { textDecoration: "line-through" } : undefined}>{title}</span>
                <span className="block text-xs" style={{ color: "var(--ink-muted)" }}>
                  {m.date}{m.start_time ? ` · ${m.start_time}` : ""}
                  {showRoundInSub && ` · ${roundLabel}`}
                </span>
              </span>
              {isMoot ? (
                <span className="caption shrink-0" style={{ color: "var(--ink-muted)", fontStyle: "italic" }}>Spelas ej</span>
              ) : (
                <>
                  {m.date === today && (
                    <span className="badge" style={{ background: "var(--accent)", color: "var(--primary-deep)" }}>I dag</span>
                  )}
                  <span className="stat-number text-base w-14 text-right" style={{ color: hasResult ? "var(--ink)" : "var(--ink-muted)" }}>
                    {hasResult ? `${m.our_score}–${m.opponent_score}` : "–"}
                  </span>
                </>
              )}
            </Link>
          );
        })}
      </div>
    </details>
  );
}

function EntryView({
  entry,
  role,
  today,
  cupScorers,
  cupForm,
}: {
  entry: Entry;
  role: string;
  today: string;
  cupScorers: Map<string, CupScorerRow[]>;
  cupForm: Map<string, CupFormRow[]>;
}) {
  if (entry.kind === "cup") {
    return (
      <CupCard
        name={entry.name}
        cupGroup={entry.cupGroup}
        matches={entry.matches}
        today={today}
        role={role}
        scorers={cupScorers.get(entry.name) ?? []}
        formLeaders={cupForm.get(entry.name) ?? []}
      />
    );
  }
  return <MatchCard m={entry.m} role={role} today={today} />;
}

function MatchSections({
  matches,
  role,
  cupScorers,
  cupForm,
}: {
  matches: MatchType[];
  role: string;
  cupScorers: Map<string, CupScorerRow[]>;
  cupForm: Map<string, CupFormRow[]>;
}) {
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
          <h2 className="font-semibold text-[18px]">Kommande</h2>
          <span className="caption" style={{ color: "var(--ink-muted)" }}>
            {countMatches(upcoming)} matcher
          </span>
        </div>
        {upcoming.length === 0 ? (
          <p className="body-small card p-5" style={{ color: "var(--ink-secondary)" }}>
            Inga kommande matcher – hämta från kalendern under Inställningar när nya matcher
            planerats.
          </p>
        ) : (
          <div className="grid gap-3">
            {upcoming.map((e) => (
              <EntryView key={e.key} entry={e} role={role} today={today} cupScorers={cupScorers} cupForm={cupForm} />
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <div className="flex items-baseline gap-2.5 mb-3">
            <h2 className="font-semibold text-[18px]">Spelade</h2>
            <span className="caption" style={{ color: "var(--ink-muted)" }}>
              {countMatches(past)} matcher
            </span>
          </div>
          <div className="grid gap-3">
            {past.map((e) => (
              <EntryView key={e.key} entry={e} role={role} today={today} cupScorers={cupScorers} cupForm={cupForm} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
