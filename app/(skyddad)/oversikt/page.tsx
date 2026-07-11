import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getRole, hasPermission } from "@/lib/auth";
import { getAllSettings, getRecentActivity, type ActivityEntry } from "@/lib/db";
import {
  getPlayers,
  getMatches,
  getLatestEvaluationDates,
  getMatchesWithSquad,
  getMatchScorers,
  getFormOverview,
  getIntervjuer,
  cupRoundLabel,
  matchTitle,
  mootMatchIds,
} from "@/lib/queries";
import { swedishToday, swedishDate, swedishDateOffset } from "@/lib/dates";
import { FEATURES } from "@/lib/features";
import { GAME_FORMAT } from "@/lib/svff";
import { ratingBand } from "@/lib/rating";
import Avatar from "@/components/Avatar";
import PitchLines from "@/components/PitchLines";
import { Card, Badge, EmptyState } from "@/components/ui";
import {
  IconClock,
  IconCheck,
  IconArrowRight,
  IconBall,
  IconWhistle,
  IconChat,
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
  const user = await getCurrentUser();

  const [settings, players, matches, latestEvals, activity, formRows, canViewInterviews, allInterviews] =
    await Promise.all([
      getAllSettings(),
      getPlayers(),
      getMatches(),
      getLatestEvaluationDates(),
      user?.groupIds.length ? Promise.resolve([] as ActivityEntry[]) : getRecentActivity(6),
      getFormOverview(),
      hasPermission("view_interviews"),
      getIntervjuer(),
    ]);

  const todayStr = swedishToday();
  const moot = mootMatchIds(matches);
  const upcomingMatches = matches
    .filter((m) => m.date >= todayStr && !m.finished && !moot.has(m.id))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start_time ?? "").localeCompare(b.start_time ?? ""))
    .slice(0, 2);

  const latestMatch = matches.find(
    (m) => (m.finished || m.our_score !== null) && m.date <= todayStr && !moot.has(m.id)
  );

  const [matchesWithSquad, scorers] = await Promise.all([
    getMatchesWithSquad(upcomingMatches.map((m) => m.id)),
    latestMatch ? getMatchScorers(latestMatch.id) : Promise.resolve([]),
  ]);

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

  const liveMatch = FEATURES.liveScore
    ? matches.find((m) => m.clock_running === 1 && !m.finished)
    : undefined;
  const todayMatch = FEATURES.liveScore
    ? matches.find(
        (m) => m.date === todayStr && !m.finished && !moot.has(m.id) && m.our_score == null
      )
    : undefined;
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
        : FEATURES.matchStats
          ? { href: "/matcher/ny", label: "Registrera match", live: false, note: null }
          : null;

  const cutoffStr = swedishDateOffset(-60);
  const needsEval = players.filter((p) => !latestEvals[p.id] || latestEvals[p.id] < cutoffStr);

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

  const interviewCutoff = swedishDateOffset(-14);
  const recentInterviews = canViewInterviews
    ? allInterviews.filter((iv) => iv.created_at.slice(0, 10) >= interviewCutoff)
    : [];

  const todos: Todo[] = [
    ...(FEATURES.matchStats
      ? upcomingMatches
          .filter((m) => !matchesWithSquad.has(m.id))
          .map((m) => ({
            key: `squad-${m.id}`,
            href: `/matcher/${m.id}/laguttagning`,
            title: "Ta ut trupp",
            sub: matchTitle(m),
            icon: <IconWhistle width={16} height={16} />,
          }))
      : []),
    ...(FEATURES.liveScore
      ? pastUnreported.map((m) => ({
          key: `result-${m.id}`,
          href: `/matcher/${m.id}/live`,
          title: "Rapportera resultat",
          sub: matchTitle(m),
          icon: <IconBall width={16} height={16} />,
        }))
      : []),
    ...needsEval.map((p) => ({
      key: `eval-${p.id}`,
      href: `/spelare/${p.id}/utvardera`,
      title: `Utvärdera ${p.name}`,
      sub: latestEvals[p.id] ? `Senast ${latestEvals[p.id]}` : "Aldrig utvärderad",
      player: { name: p.name, jersey: p.jersey_number },
    })),
    ...recentInterviews.map((iv) => ({
      key: `interview-${iv.id}`,
      href: "/spelare/intervjuer",
      title: `Läs samtal med ${iv.player_name}`,
      sub: iv.interview_type === "kvartal" ? "Kvartalssamtal" : "Nytt spelarsamtal",
      icon: <IconChat width={16} height={16} />,
    })),
  ];

  const rising = formRows
    .filter((f) => (f.last_delta ?? 0) > 0)
    .sort((a, b) => (b.last_delta ?? 0) - (a.last_delta ?? 0))
    .slice(0, 3);
  const falling = formRows
    .filter((f) => (f.last_delta ?? 0) < 0)
    .sort((a, b) => (a.last_delta ?? 0) - (b.last_delta ?? 0))
    .slice(0, 3);

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
      ? { bg: "var(--ok-bg)", fg: "var(--success)" }
      : lmOutcome === "loss"
        ? { bg: "var(--danger-bg)", fg: "var(--danger)" }
        : { bg: "var(--warn-bg)", fg: "var(--warning)" };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div
        className="relative overflow-hidden fade-lift"
        style={{
          borderRadius: "var(--r-card)",
          background: "var(--elevated)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-sm)",
          padding: "28px 24px",
        }}
      >
        <PitchLines className="pointer-events-none absolute -right-14 -top-24 w-56 rotate-12 pitch-watermark" />
        <div className="relative flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
          {/* Vänster: laginfo + säsongssiffror + smart åtgärd */}
          <div>
            <p className="eyebrow">Säsong {settings.season} · {GAME_FORMAT.format}</p>
            <h1 className="mt-1.5" style={{ fontSize: "32px" }}>
              {settings.team_name}
            </h1>

            {/* Säsongssiffror i korthet */}
            <div className="mt-5 flex flex-wrap gap-2.5">
              <KpiChip label="Spelade" value={played.length} />
              <KpiChip label="V–O–F">
                <span style={{ color: "var(--success)" }}>{record.w}</span>
                <span style={{ color: "var(--ink-muted)" }}>–</span>
                <span style={{ color: "var(--warning)" }}>{record.d}</span>
                <span style={{ color: "var(--ink-muted)" }}>–</span>
                <span style={{ color: "var(--danger)" }}>{record.l}</span>
              </KpiChip>
              <KpiChip label="Mål">
                {record.gf}
                <span style={{ color: "var(--ink-muted)", fontSize: "0.9rem" }}> / {record.ga}</span>
              </KpiChip>
              <KpiChip label="Trupp" value={players.length} />
            </div>

            {/* Kontextuell primär-åtgärd */}
            {heroCta && (
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link
                href={heroCta.href}
                className="btn-primary"
                style={heroCta.live ? { background: "var(--live)", color: "#fff" } : undefined}
              >
                {heroCta.label}
              </Link>
              {heroCta.note && (
                <span className="body-small" style={{ color: "var(--ink-secondary)" }}>
                  {heroCta.note}
                </span>
              )}
            </div>
            )}
          </div>

          {/* Höger: kommande matcher */}
          <div className="lg:min-w-[240px] lg:max-w-[280px] shrink-0">
            <p
              className="caption mb-3"
              style={{ color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}
            >
              Kommande matcher
            </p>
            {upcomingMatches.length === 0 ? (
              <p className="body-small" style={{ color: "var(--ink-muted)" }}>Inga schemalagda matcher</p>
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
                      className="flex items-center gap-3 transition-opacity hover:opacity-80"
                      style={{
                        borderRadius: "var(--r-button)",
                        padding: "12px 14px",
                        background: "var(--surface)",
                        border: `1px solid ${hasSquad ? "var(--border)" : "var(--primary-line)"}`,
                      }}
                    >
                      <div
                        className="flex flex-col items-center justify-center shrink-0"
                        style={{ width: 44, height: 44, borderRadius: "var(--r-button)", background: "var(--primary)", color: "var(--primary-deep)" }}
                      >
                        <span className="caption leading-none opacity-70" style={{ fontWeight: 600, textTransform: "uppercase" }}>{weekday}</span>
                        <span className="text-base leading-tight" style={{ fontFamily: "var(--font-display)", fontWeight: 400 }}>
                          {d.getDate()}
                        </span>
                        <span className="caption leading-none opacity-70" style={{ textTransform: "uppercase" }}>{d.toLocaleDateString("sv-SE", { month: "short" })}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="body-small font-semibold truncate" style={{ color: "var(--ink)" }}>
                          {!m.opponent || m.opponent === "TBD" ? (cupRoundLabel(m) ?? "Motståndare ej klar") : m.opponent}
                        </p>
                        <p className="caption mt-0.5" style={{ color: "var(--ink-secondary)" }}>
                          {m.home_away === "home" ? "Hemma" : "Borta"}
                          {m.start_time ? ` · ${m.start_time.slice(0, 5)}` : ""}
                          {dayMonth ? ` · ${dayMonth}` : ""}
                        </p>
                      </div>
                      {!hasSquad && (
                        <Badge tone="primary">Trupp saknas</Badge>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
            {upcomingMatches.length > 0 && FEATURES.matchStats && (
              <Link
                href="/matcher"
                className="mt-3 flex items-center gap-1 caption transition-colors hover:opacity-70"
                style={{ color: "var(--ink-muted)" }}
              >
                Alla matcher <IconArrowRight width={11} height={11} />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Senaste matchen + Form just nu (dold när matchStats är av) */}
      {FEATURES.matchStats && (
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Senaste matchen */}
        <Card>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold" style={{ fontSize: "18px" }}>Senaste matchen</h2>
              <p className="caption mt-0.5" style={{ color: "var(--ink-muted)" }}>
                Så gick det sist
              </p>
            </div>
            {lm && (
              <Link
                href={`/matcher/${lm.id}`}
                className="caption font-semibold flex items-center gap-1"
                style={{ color: "var(--primary)" }}
              >
                Till matchen <IconArrowRight width={13} height={13} />
              </Link>
            )}
          </div>
          {!lm ? (
            <EmptyState
              icon={<IconBall />}
              title="Ingen spelad match ännu"
              body="När en match rapporterats ser du resultatet här."
            />
          ) : (
            <Link href={`/matcher/${lm.id}`} className="block group">
              <div
                className="flex items-center gap-4 transition-opacity group-hover:opacity-90"
                style={{
                  borderRadius: "var(--r-card)",
                  padding: "16px",
                  background: lmTone.bg,
                }}
              >
                <div className="flex flex-col items-center justify-center shrink-0" style={{ minWidth: 78 }}>
                  <span className="stat-number" style={{ fontSize: "30px", lineHeight: 1, color: lmTone.fg }}>
                    {lm.our_score ?? "–"}–{lm.opponent_score ?? "–"}
                  </span>
                  <span className="caption mt-1.5" style={{ fontWeight: 600, textTransform: "uppercase", color: lmTone.fg }}>
                    {lmOutcome === "win" ? "Vinst" : lmOutcome === "loss" ? "Förlust" : "Oavgjort"}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="body-small font-semibold truncate">{matchTitle(lm)}</p>
                  <p className="caption mt-0.5" style={{ color: "var(--ink-secondary)" }}>
                    {lm.home_away === "home" ? "Hemma" : "Borta"} · {swedishDate(new Date(lm.date))}
                  </p>
                </div>
              </div>
              {scorers.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                  {scorers.map((s) => (
                    <li key={s.player_id} className="flex items-center gap-1.5 body-small">
                      <IconBall width={13} height={13} style={{ color: "var(--ink-muted)" }} />
                      <span className="font-medium">{s.name.replace(/^Exempel:\s*/, "")}</span>
                      {s.goals > 1 && <span style={{ color: "var(--ink-secondary)" }}>×{s.goals}</span>}
                      {s.assists > 0 && (
                        <span className="caption" style={{ color: "var(--ink-muted)" }}>
                          ({s.assists} assist)
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Link>
          )}
        </Card>

        {/* Form just nu */}
        <Card>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold" style={{ fontSize: "18px" }}>Form just nu</h2>
              <p className="caption mt-0.5" style={{ color: "var(--ink-muted)" }}>
                Hur spelarna rört sig senast (matchbetyg)
              </p>
            </div>
            <Link
              href="/statistik"
              className="caption font-semibold flex items-center gap-1"
              style={{ color: "var(--primary)" }}
            >
              Visa allt <IconArrowRight width={13} height={13} />
            </Link>
          </div>
          {rising.length === 0 && falling.length === 0 ? (
            <EmptyState
              icon={<IconClock />}
              title="Inga formvärden ännu"
              body="Sätt matchbetyg efter en match så ser du vilka som är på väg upp här."
            />
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
        </Card>
      </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Att göra */}
        <Card>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold" style={{ fontSize: "18px" }}>Att göra</h2>
              <p className="caption mt-0.5" style={{ color: "var(--ink-muted)" }}>
                {FEATURES.matchStats
                  ? "Trupper, resultat och utvärderingar att ta tag i"
                  : "Utvärderingar att ta tag i"}
              </p>
            </div>
            {todos.length > 0 && (
              <Badge tone="warning">{todos.length} st</Badge>
            )}
          </div>
          {todos.length === 0 ? (
            <div
              className="flex items-center gap-3"
              style={{
                borderRadius: "var(--r-card)",
                padding: "16px",
                background: "var(--ok-bg)",
              }}
            >
              <span
                className="flex shrink-0 items-center justify-center"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "var(--r-badge)",
                  background: "var(--primary-soft)",
                  color: "var(--success)",
                }}
              >
                <IconCheck width={16} height={16} />
              </span>
              <p className="body-small" style={{ color: "var(--success)" }}>
                Allt är ikapp – inget att göra just nu. Bra jobbat!
              </p>
            </div>
          ) : (
            <ul className="-mx-2">
              {todos.slice(0, 6).map((t) => (
                <li key={t.key}>
                  <Link
                    href={t.href}
                    className="group flex items-center gap-3 transition-colors hover-ghost"
                    style={{ borderRadius: "var(--r-button)", padding: "8px 8px" }}
                  >
                    {t.player ? (
                      <Avatar name={t.player.name} jersey={t.player.jersey} size={34} />
                    ) : (
                      <span
                        className="flex shrink-0 items-center justify-center"
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: "var(--r-badge)",
                          background: "var(--warn-bg)",
                          color: "var(--warning)",
                        }}
                      >
                        {t.icon}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate body-small font-medium">{t.title}</p>
                      <p className="truncate caption" style={{ color: "var(--ink-muted)" }}>
                        {t.sub}
                      </p>
                    </div>
                    <span
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: "var(--primary)" }}
                    >
                      <IconArrowRight width={16} height={16} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Aktivitetslogg */}
        <Card>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="eyebrow mb-1">Tränarlaget</p>
              <h2 className="font-semibold" style={{ fontSize: "18px" }}>Senaste aktivitet</h2>
            </div>
          </div>
          {activity.length === 0 ? (
            <p className="body-small" style={{ color: "var(--ink-muted)" }}>
              Ingen aktivitet ännu. Loggen uppdateras när trupper tas ut, matcher sparas eller utvärderingar skapas.
            </p>
          ) : (
            <ol className="space-y-4">
              {activity.map((entry: ActivityEntry) => (
                <li key={entry.id} className="flex items-start gap-3">
                  <span
                    className="flex shrink-0 items-center justify-center mt-0.5"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "var(--r-badge)",
                      background: "var(--primary-soft)",
                      color: "var(--primary)",
                    }}
                  >
                    <IconClock width={13} height={13} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="body-small" style={{ color: "var(--ink)" }}>
                      <span className="font-semibold">{entry.coach_name}</span>{" "}
                      <span style={{ color: "var(--ink-secondary)" }}>{entry.action.toLowerCase()}</span>
                      {entry.subject ? (
                        <> &ndash; {entry.subject}</>
                      ) : null}
                    </p>
                    <p className="caption mt-0.5" style={{ color: "var(--ink-muted)" }}>
                      {formatActivityTime(entry.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {/* Länk till grunden */}
      <Link href="/guide" className="block">
        <Card hover className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="flex shrink-0 items-center justify-center"
              style={{
                width: 36,
                height: 36,
                borderRadius: "var(--r-button)",
                background: "var(--primary-soft)",
                color: "var(--primary)",
              }}
            >
              <IconCheck width={16} height={16} strokeWidth={2.4} />
            </span>
            <div>
              <p className="body-small font-semibold">SvFF:s riktlinjer som appen bygger på</p>
              <p className="caption" style={{ color: "var(--ink-muted)" }}>
                Vår grund – så tänker vi kring speltid, utveckling och glädje
              </p>
            </div>
          </div>
          <IconArrowRight width={16} height={16} style={{ color: "var(--ink-muted)" }} />
        </Card>
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
    <div
      style={{
        borderRadius: "var(--r-button)",
        padding: "10px 14px",
        background: "var(--surface)",
      }}
    >
      <p
        className="caption"
        style={{ color: "var(--ink-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}
      >
        {label}
      </p>
      <p className="stat-number" style={{ fontSize: "22px", lineHeight: 1.2, marginTop: 2 }}>
        {children ?? value}
      </p>
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
  const color = up ? "var(--success)" : "var(--danger)";
  return (
    <div>
      <p className="eyebrow mb-2" style={{ color: "var(--ink-muted)" }}>
        {title}
      </p>
      <ul className="-mx-2">
        {rows.map((f) => (
          <li key={f.id}>
            <Link
              href={`/spelare/${f.id}`}
              className="group flex items-center gap-3 transition-colors hover-ghost"
              style={{ borderRadius: "var(--r-button)", padding: "8px 8px" }}
            >
              <Avatar name={f.name} jersey={f.jersey_number} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate body-small font-medium">{f.name.replace(/^Exempel:\s*/, "")}</p>
                <p className="caption" style={{ color: "var(--ink-muted)" }}>
                  Form {ratingBand(f.form_rating).label}
                </p>
              </div>
              <span className="stat-number body-small flex items-center gap-0.5" style={{ color }}>
                {up ? "▲" : "▼"} {Math.abs(f.last_delta ?? 0)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
