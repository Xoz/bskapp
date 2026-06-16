import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getAllSettings, getRecentActivity, type ActivityEntry } from "@/lib/db";
import {
  getPlayers,
  getMatches,
  getLatestEvaluationDates,
  getMatchesWithSquad,
  getMatchScorers,
  getFormOverview,
  cupRoundLabel,
  matchTitle,
  mootMatchIds,
} from "@/lib/queries";
import { swedishToday, swedishDate, swedishDateOffset } from "@/lib/dates";
import { GAME_FORMAT } from "@/lib/svff";
import { ratingBand } from "@/lib/rating";
import Avatar from "@/components/Avatar";
import PitchLines from "@/components/PitchLines";
import {
  IconClock,
  IconCheck,
  IconArrowRight,
  IconBall,
  IconWhistle,
} from "@/components/Icons";

function formatActivityTime(ts: string): string {
  const d = new Date(ts.replace(" ", "T") + "Z");
  const time = d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Stockholm" });
  if (swedishDate(d) === swedishToday()) return time;
  return d.toLocaleDateString("sv-SE", { month: "short", day: "numeric", timeZone: "Europe/Stockholm" }) + " " + time;
}

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const role = await getRole();
  if (role !== "coach") redirect("/matcher");

  // Oberoende queries körs parallellt – annars staplas latensen mot Turso.
  const [settings, players, matches, latestEvals, activity, formRows] =
    await Promise.all([
      getAllSettings(),
      getPlayers(),
      getMatches(),
      getLatestEvaluationDates(),
      getRecentActivity(6),
      getFormOverview(),
    ]);

  const todayStr = swedishToday();
  // Dölj slutspelsmatcher laget inte längre spelar efter utslagning (t.ex. final
  // efter semifinalförlust).
  const moot = mootMatchIds(matches);
  const upcomingMatches = matches
    .filter((m) => m.date >= todayStr && !m.finished && !moot.has(m.id))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start_time ?? "").localeCompare(b.start_time ?? ""))
    .slice(0, 2);

  // matches är sorterad datum fallande – senaste spelade ligger först. Dölj
  // slutspelsmatcher som blev överflödiga efter utslagning (t.ex. en inställd
  // final efter semifinalförlust) precis som i kommande-listan ovan.
  const latestMatch = matches.find(
    (m) => (m.finished || m.our_score !== null) && m.date <= todayStr && !moot.has(m.id)
  );

  const [matchesWithSquad, scorers] = await Promise.all([
    getMatchesWithSquad(upcomingMatches.map((m) => m.id)),
    latestMatch ? getMatchScorers(latestMatch.id) : Promise.resolve([]),
  ]);

  // Säsongssiffror – aggregat över alla spelade matcher (serie + cuper).
  const played = matches.filter(
    (m) => m.our_score != null && m.opponent_score != null
  );
  const record = played.reduce(
    (acc, m) => {
      if (m.our_score! > m.opponent_score!) acc.w++;
      else if (m.our_score! < m.opponent_score!) acc.l++;
      else acc.d++;
      acc.gf += m.our_score!;
      acc.ga += m.opponent_score!;
      return acc;
    },
    { w: 0, d: 0, l: 0, gf: 0, ga: 0 }
  );

  // Smart primär-CTA: visar mest akuta åtgärden just nu i prioritetsordning
  // live → match idag → trupp saknas till nästa → registrera ny match.
  const liveMatch = matches.find((m) => m.clock_running === 1 && !m.finished);
  const todayMatch = matches.find(
    (m) => m.date === todayStr && !m.finished && !moot.has(m.id) && m.our_score == null
  );
  const nextNoSquad = upcomingMatches.find((m) => !matchesWithSquad.has(m.id));
  const nextOpp = nextNoSquad
    ? nextNoSquad.opponent && nextNoSquad.opponent !== "TBD"
      ? nextNoSquad.opponent
      : cupRoundLabel(nextNoSquad) ?? "match"
    : "";
  const heroCta = liveMatch
    ? { href: `/matcher/${liveMatch.id}/live`, label: "Fortsätt rapportera", live: true, note: "Matchen pågår" }
    : todayMatch
      ? { href: `/matcher/${todayMatch.id}/live`, label: "Rapportera dagens match", live: false, note: null }
      : nextNoSquad
        ? { href: `/matcher/${nextNoSquad.id}/laguttagning`, label: `Ta ut trupp · ${nextOpp}`, live: false, note: "Trupp saknas till nästa match" }
        : { href: "/matcher/ny", label: "Registrera match", live: false, note: null };

  const cutoffStr = swedishDateOffset(-60);
  const needsEval = players.filter((p) => !latestEvals[p.id] || latestEvals[p.id] < cutoffStr);

  // Att göra: samlar tränarlagets akuta åtgärder på ett ställe. Listan byggs av
  // flera todo-källor – lägg till fler genom att pusha in i todos-arrayen.
  type Todo = {
    key: string;
    href: string;
    title: string;
    sub: string;
    icon?: ReactNode;
    player?: { name: string; jersey: number | null };
  };

  const pastUnreported = matches.filter(
    (m) => m.date < todayStr && m.our_score == null && !moot.has(m.id)
  );

  const todos: Todo[] = [
    ...upcomingMatches
      .filter((m) => !matchesWithSquad.has(m.id))
      .map((m) => ({
        key: `squad-${m.id}`,
        href: `/matcher/${m.id}/laguttagning`,
        title: "Ta ut trupp",
        sub: matchTitle(m),
        icon: <IconWhistle width={16} height={16} />,
      })),
    ...pastUnreported.map((m) => ({
      key: `result-${m.id}`,
      href: `/matcher/${m.id}/live`,
      title: "Rapportera resultat",
      sub: matchTitle(m),
      icon: <IconBall width={16} height={16} />,
    })),
    ...needsEval.map((p) => ({
      key: `eval-${p.id}`,
      href: `/spelare/${p.id}/utvardera`,
      title: `Utvärdera ${p.name}`,
      sub: latestEvals[p.id] ? `Senast ${latestEvals[p.id]}` : "Aldrig utvärderad",
      player: { name: p.name, jersey: p.jersey_number },
    })),
  ];

  // Form just nu: hetaste (störst uppgång senast) och de som tappat.
  const rising = formRows
    .filter((f) => (f.last_delta ?? 0) > 0)
    .sort((a, b) => (b.last_delta ?? 0) - (a.last_delta ?? 0))
    .slice(0, 3);
  const falling = formRows
    .filter((f) => (f.last_delta ?? 0) < 0)
    .sort((a, b) => (a.last_delta ?? 0) - (b.last_delta ?? 0))
    .slice(0, 3);

  // Resultatfärg för senaste matchen (vinst/oavgjort/förlust).
  const lm = latestMatch;
  const lmOutcome =
    lm == null || lm.our_score == null || lm.opponent_score == null
      ? null
      : lm.our_score > lm.opponent_score
        ? "win"
        : lm.our_score < lm.opponent_score
          ? "loss"
          : "draw";
  const lmTone =
    lmOutcome === "win"
      ? { bg: "var(--ok-bg)", fg: "var(--ok)" }
      : lmOutcome === "loss"
        ? { bg: "var(--danger-bg)", fg: "var(--danger)" }
        : { bg: "var(--warn-bg)", fg: "var(--warn)" };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="panel-dark p-7 md:p-9">
        <PitchLines className="pointer-events-none absolute -right-14 -top-24 w-56 rotate-12 pitch-watermark" />
        <div className="relative flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
          {/* Vänster: laginfo + säsongssiffror + smart åtgärd */}
          <div>
            <p className="eyebrow">Säsong {settings.season} · {GAME_FORMAT.format}</p>
            <h1
              className="mt-1.5 text-3xl md:text-[2.1rem] font-bold tracking-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {settings.team_name}
            </h1>

            {/* Säsongssiffror i korthet */}
            <div className="mt-5 flex flex-wrap gap-2.5">
              <KpiChip label="Spelade" value={played.length} />
              <KpiChip label="V–O–F">
                <span style={{ color: "var(--ok)" }}>{record.w}</span>
                <span style={{ color: "var(--ink-faint)" }}>–</span>
                <span style={{ color: "var(--warn)" }}>{record.d}</span>
                <span style={{ color: "var(--ink-faint)" }}>–</span>
                <span style={{ color: "var(--danger)" }}>{record.l}</span>
              </KpiChip>
              <KpiChip label="Mål">
                {record.gf}
                <span style={{ color: "var(--ink-faint)", fontSize: "0.9rem" }}> / {record.ga}</span>
              </KpiChip>
              <KpiChip label="Trupp" value={players.length} />
            </div>

            {/* Kontextuell primär-åtgärd */}
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link
                href={heroCta.href}
                className="btn-accent"
                style={heroCta.live ? { background: "var(--live)", color: "#fff" } : undefined}
              >
                {heroCta.label}
              </Link>
              {heroCta.note && (
                <span className="text-[0.8rem]" style={{ color: "var(--ink-soft)" }}>
                  {heroCta.note}
                </span>
              )}
            </div>
          </div>

          {/* Höger: kommande matcher */}
          <div className="lg:min-w-[240px] lg:max-w-[280px] shrink-0">
            <p className="text-[0.65rem] uppercase tracking-[0.12em] mb-3" style={{ color: "var(--ink-faint)" }}>
              Kommande matcher
            </p>
            {upcomingMatches.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--ink-faint)" }}>Inga schemalagda matcher</p>
            ) : (
              <div className="space-y-2">
                {upcomingMatches.map((m) => {
                  const d = new Date(m.date);
                  const weekday = d.toLocaleDateString("sv-SE", { weekday: "short" });
                  const dayMonth = d.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
                  const hasSquad = matchesWithSquad.has(m.id);
                  return (
                    <Link
                      key={m.id}
                      href={`/matcher/${m.id}/laguttagning`}
                      className="flex items-center gap-3 rounded-xl px-3.5 py-3 transition-opacity hover:opacity-80"
                      style={{ background: "var(--bg2)", border: `1px solid ${hasSquad ? "var(--line)" : "color-mix(in srgb, var(--primary), transparent 55%)"}` }}
                    >
                      <div
                        className="flex flex-col items-center justify-center rounded-lg shrink-0"
                        style={{ width: 44, height: 44, background: "var(--accent)", color: "var(--accent-ink, #111)" }}
                      >
                        <span className="text-[0.55rem] uppercase font-semibold leading-none opacity-70">{weekday}</span>
                        <span className="text-base font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                          {d.getDate()}
                        </span>
                        <span className="text-[0.55rem] uppercase opacity-70 leading-none">{d.toLocaleDateString("sv-SE", { month: "short" })}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>
                          {!m.opponent || m.opponent === "TBD" ? (cupRoundLabel(m) ?? "Motståndare ej klar") : m.opponent}
                        </p>
                        <p className="text-[0.7rem] mt-0.5" style={{ color: "var(--ink-soft)" }}>
                          {m.home_away === "home" ? "Hemma" : "Borta"}
                          {m.start_time ? ` · ${m.start_time.slice(0, 5)}` : ""}
                          {dayMonth ? ` · ${dayMonth}` : ""}
                        </p>
                      </div>
                      {!hasSquad && (
                        <span
                          className="shrink-0 text-[0.6rem] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide"
                          style={{ background: "var(--primary-soft)", color: "var(--primary-fg)" }}
                        >
                          Trupp saknas
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
            {upcomingMatches.length > 0 && (
              <Link
                href="/matcher"
                className="mt-3 flex items-center gap-1 text-[0.7rem] transition-colors"
                style={{ color: "var(--ink-faint)" }}
              >
                Alla matcher <IconArrowRight width={11} height={11} />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Senaste matchen + Form just nu */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Senaste matchen */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-[1.05rem]">Senaste matchen</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
                Så gick det sist
              </p>
            </div>
            {lm && (
              <Link
                href={`/matcher/${lm.id}`}
                className="text-xs font-semibold flex items-center gap-1"
                style={{ color: "var(--primary-fg)", fontFamily: "var(--font-display)" }}
              >
                Till matchen <IconArrowRight width={13} height={13} />
              </Link>
            )}
          </div>
          {!lm ? (
            <div className="rounded-2xl border border-dashed p-5 text-center" style={{ borderColor: "var(--line-strong)" }}>
              <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "var(--primary-soft)", color: "var(--primary-fg)" }}>
                <IconBall />
              </span>
              <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                Ingen spelad match ännu. När en match rapporterats ser du resultatet här.
              </p>
            </div>
          ) : (
            <Link href={`/matcher/${lm.id}`} className="block group">
              <div
                className="flex items-center gap-4 rounded-2xl px-4 py-4 transition-opacity group-hover:opacity-90"
                style={{ background: lmTone.bg }}
              >
                <div className="flex flex-col items-center justify-center shrink-0" style={{ minWidth: 78 }}>
                  <span className="stat-number text-[1.9rem] leading-none" style={{ color: lmTone.fg }}>
                    {lm.our_score ?? "–"}–{lm.opponent_score ?? "–"}
                  </span>
                  <span className="text-[0.6rem] uppercase tracking-wide font-semibold mt-1.5" style={{ color: lmTone.fg }}>
                    {lmOutcome === "win" ? "Vinst" : lmOutcome === "loss" ? "Förlust" : "Oavgjort"}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{matchTitle(lm)}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--ink-soft)" }}>
                    {lm.home_away === "home" ? "Hemma" : "Borta"} · {swedishDate(new Date(lm.date))}
                  </p>
                </div>
              </div>
              {scorers.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                  {scorers.map((s) => (
                    <li key={s.player_id} className="flex items-center gap-1.5 text-sm">
                      <IconBall width={13} height={13} style={{ color: "var(--ink-faint)" }} />
                      <span className="font-medium">{s.name.replace(/^Exempel:\s*/, "")}</span>
                      {s.goals > 1 && <span style={{ color: "var(--ink-soft)" }}>×{s.goals}</span>}
                      {s.assists > 0 && (
                        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
                          ({s.assists} assist)
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Link>
          )}
        </div>

        {/* Form just nu */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-[1.05rem]">Form just nu</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
                Hur spelarna rört sig senast (matchbetyg)
              </p>
            </div>
            <Link
              href="/statistik"
              className="text-xs font-semibold flex items-center gap-1"
              style={{ color: "var(--primary-fg)", fontFamily: "var(--font-display)" }}
            >
              Visa allt <IconArrowRight width={13} height={13} />
            </Link>
          </div>
          {rising.length === 0 && falling.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-5 text-center" style={{ borderColor: "var(--line-strong)" }}>
              <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "var(--primary-soft)", color: "var(--primary-fg)" }}>
                <IconClock />
              </span>
              <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                Sätt matchbetyg efter en match så ser du vilka som är på väg upp här.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {rising.length > 0 && (
                <FormList title="På uppgång" tone="up" rows={rising} />
              )}
              {falling.length > 0 && (
                <FormList title="Tappat senast" tone="down" rows={falling} />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Att göra */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-[1.05rem]">Att göra</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
                Trupper, resultat och utvärderingar att ta tag i
              </p>
            </div>
            {todos.length > 0 && (
              <span className="badge" style={{ background: "var(--warn-bg)", color: "var(--warn)" }}>
                {todos.length} st
              </span>
            )}
          </div>
          {todos.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl p-4" style={{ background: "var(--ok-bg)" }}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--teal-dim)", color: "var(--ok)" }}>
                <IconCheck width={16} height={16} />
              </span>
              <p className="text-sm" style={{ color: "var(--ok)" }}>
                Allt är ikapp – inget att göra just nu. Bra jobbat!
              </p>
            </div>
          ) : (
            <ul className="-mx-2">
              {todos.slice(0, 6).map((t) => (
                <li key={t.key}>
                  <Link
                    href={t.href}
                    className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--primary-ghost)]"
                  >
                    {t.player ? (
                      <Avatar name={t.player.name} jersey={t.player.jersey} size={34} />
                    ) : (
                      <span
                        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full"
                        style={{ background: "var(--warn-bg)", color: "var(--warn)" }}
                      >
                        {t.icon}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <p className="truncate text-xs" style={{ color: "var(--ink-faint)" }}>
                        {t.sub}
                      </p>
                    </div>
                    <span
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: "var(--primary-fg)" }}
                    >
                      <IconArrowRight width={16} height={16} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Aktivitetslogg */}
        <div className="card p-6">
          <p className="eyebrow mb-1">Tränarlaget</p>
          <h2 className="font-semibold text-[1.05rem] mb-5">Senaste aktivitet</h2>
          {activity.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--ink-faint)" }}>
              Ingen aktivitet ännu. Loggen uppdateras när trupper tas ut, matcher sparas eller utvärderingar skapas.
            </p>
          ) : (
            <ol className="space-y-4">
              {activity.map((entry: ActivityEntry) => (
                <li key={entry.id} className="flex items-start gap-3">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full mt-0.5"
                    style={{ background: "var(--primary-soft)", color: "var(--primary-fg)" }}
                  >
                    <IconClock width={13} height={13} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm" style={{ color: "var(--ink)" }}>
                      <span className="font-semibold">{entry.coach_name}</span>{" "}
                      <span style={{ color: "var(--ink-soft)" }}>{entry.action.toLowerCase()}</span>
                      {entry.subject ? (
                        <> &ndash; {entry.subject}</>
                      ) : null}
                    </p>
                    <p className="text-[0.7rem] mt-0.5" style={{ color: "var(--ink-faint)" }}>
                      {formatActivityTime(entry.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>


      {/* Länk till grunden – principerna bor i guiden, inte på startsidan */}
      <Link
        href="/guide"
        className="card card-hover flex items-center justify-between gap-3 px-6 py-4"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--primary-soft)", color: "var(--primary-fg)" }}>
            <IconCheck width={16} height={16} strokeWidth={2.4} />
          </span>
          <div>
            <p className="text-sm font-semibold">SvFF:s riktlinjer som appen bygger på</p>
            <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
              Vår grund – så tänker vi kring speltid, utveckling och glädje
            </p>
          </div>
        </div>
        <IconArrowRight width={16} height={16} style={{ color: "var(--ink-faint)" }} />
      </Link>
    </div>
  );
}

// Liten siffer-chip i heron: etikett + värde (tal eller färgad nod).
function KpiChip({
  label,
  value,
  children,
}: {
  label: string;
  value?: number | string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl px-3.5 py-2.5" style={{ background: "var(--bg3)" }}>
      <p
        className="text-[0.6rem] uppercase tracking-[0.08em]"
        style={{ color: "var(--ink-soft)" }}
      >
        {label}
      </p>
      <p className="stat-number text-[1.4rem] leading-tight mt-0.5">{children ?? value}</p>
    </div>
  );
}

// Liten lista för form-blocket: spelare + hur mycket formen rörde sig senast.
function FormList({
  title,
  tone,
  rows,
}: {
  title: string;
  tone: "up" | "down";
  rows: { id: number; name: string; jersey_number: number | null; form_rating: number; last_delta: number | null }[];
}) {
  const up = tone === "up";
  const color = up ? "var(--ok)" : "var(--danger)";
  return (
    <div>
      <p className="eyebrow mb-2" style={{ color: "var(--ink-faint)" }}>
        {title}
      </p>
      <ul className="-mx-2">
        {rows.map((f) => (
          <li key={f.id}>
            <Link
              href={`/spelare/${f.id}`}
              className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--primary-ghost)]"
            >
              <Avatar name={f.name} jersey={f.jersey_number} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{f.name.replace(/^Exempel:\s*/, "")}</p>
                <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
                  Form {ratingBand(f.form_rating).label}
                </p>
              </div>
              <span className="stat-number text-sm flex items-center gap-0.5" style={{ color }}>
                {up ? "▲" : "▼"} {Math.abs(f.last_delta ?? 0)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
