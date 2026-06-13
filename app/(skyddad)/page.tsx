import Link from "next/link";
import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getAllSettings } from "@/lib/db";
import {
  getPlayers,
  getMatches,
  getSeasonStats,
  getLatestEvaluationDates,
  countEvaluations,
} from "@/lib/queries";
import { SVFF_PRINCIPLES, GAME_FORMAT } from "@/lib/svff";
import Avatar from "@/components/Avatar";
import PitchLines from "@/components/PitchLines";
import {
  IconPlayers,
  IconPitch,
  IconTrendUp,
  IconAlert,
  IconClock,
  IconCheck,
  IconArrowRight,
} from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const role = await getRole();
  if (role !== "coach") redirect("/matcher");

  const settings = await getAllSettings();
  const players = await getPlayers();
  const matches = await getMatches();
  const stats = await getSeasonStats();
  const latestEvals = await getLatestEvaluationDates();
  const totalEvals = await countEvaluations();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const needsEval = players.filter((p) => !latestEvals[p.id] || latestEvals[p.id] < cutoffStr);

  const playing = stats.filter((s) => s.matches_played > 0);
  const avgMatches =
    playing.length > 0
      ? playing.reduce((a, b) => a + b.matches_played, 0) / playing.length
      : 0;
  const lowParticipation = stats.filter(
    (s) => avgMatches > 0 && s.matches_played < avgMatches * 0.75
  );

  const kpis = [
    { label: "Spelare i truppen", value: players.length, href: "/spelare", Icon: IconPlayers },
    { label: "Matcher", value: matches.length, href: "/matcher", Icon: IconPitch },
    { label: "Utvärderingar", value: totalEvals, href: "/spelare", Icon: IconTrendUp },
    {
      label: "Att utvärdera",
      value: needsEval.length,
      href: "/spelare",
      Icon: IconAlert,
      warn: needsEval.length > 0,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="panel-dark p-7 md:p-9">
        <PitchLines className="pointer-events-none absolute -right-14 -top-24 w-56 rotate-12 text-white/[0.06]" />
        <div className="relative">
          <p className="eyebrow text-white/45">Säsong {settings.season}</p>
          <h1
            className="mt-1.5 text-3xl md:text-[2.1rem] font-bold tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {settings.team_name}
          </h1>
          <p className="mt-2 text-sm text-white/60 max-w-lg">
            Spelform {GAME_FORMAT.format} · {GAME_FORMAT.periods} · {GAME_FORMAT.ballSize}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/matcher/ny" className="btn-accent">
              Registrera match
            </Link>
            <Link
              href="/rapportera"
              className="btn-secondary"
              style={{ background: "transparent", border: "1px solid var(--line-strong)", color: "var(--ink)" }}
            >
              Rapportera statistik
            </Link>
            <Link
              href="/spelare"
              className="btn-secondary"
              style={{ background: "transparent", border: "1px solid var(--line-strong)", color: "var(--ink)" }}
            >
              Till truppen
            </Link>
          </div>
        </div>
      </div>

      {/* KPI:er */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, href, Icon, warn }) => (
          <Link key={label} href={href} className="card card-hover p-5">
            <div className="flex items-start justify-between">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{
                  background: warn ? "var(--warn-bg)" : "var(--primary-soft)",
                  color: warn ? "var(--warn)" : "var(--primary)",
                }}
              >
                <Icon />
              </span>
            </div>
            <p
              className="stat-number mt-4 text-[2rem] leading-none"
              style={{ color: warn ? "var(--warn)" : "var(--ink)" }}
            >
              {value}
            </p>
            <p className="mt-1.5 text-[0.8rem]" style={{ color: "var(--ink-soft)" }}>
              {label}
            </p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Dags att utvärdera */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-[1.05rem]">Dags att utvärdera</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
                Ingen utvärdering på 60 dagar
              </p>
            </div>
            {needsEval.length > 0 && (
              <span className="badge" style={{ background: "var(--warn-bg)", color: "var(--warn)" }}>
                {needsEval.length} st
              </span>
            )}
          </div>
          {needsEval.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl p-4" style={{ background: "var(--ok-bg)" }}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--teal-dim)", color: "var(--ok)" }}>
                <IconCheck width={16} height={16} />
              </span>
              <p className="text-sm" style={{ color: "var(--ok)" }}>
                Alla spelare har en aktuell utvärdering. Bra jobbat!
              </p>
            </div>
          ) : (
            <ul className="-mx-2">
              {needsEval.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/spelare/${p.id}/utvardera`}
                    className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--primary-ghost)]"
                  >
                    <Avatar name={p.name} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
                        {latestEvals[p.id] ? `Senast ${latestEvals[p.id]}` : "Aldrig utvärderad"}
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
        </div>

        {/* Jämnt deltagande */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-[1.05rem]">Jämnt deltagande</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
                SvFF: alla ska få spela lika mycket
              </p>
            </div>
            <Link
              href="/statistik"
              className="text-xs font-semibold flex items-center gap-1"
              style={{ color: "var(--primary)", fontFamily: "var(--font-display)" }}
            >
              Visa allt <IconArrowRight width={13} height={13} />
            </Link>
          </div>
          {avgMatches === 0 ? (
            <div className="rounded-2xl border border-dashed p-5 text-center" style={{ borderColor: "var(--line-strong)" }}>
              <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
                <IconClock />
              </span>
              <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                När matchstatistik rapporterats ser du deltagandet här.
              </p>
            </div>
          ) : lowParticipation.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl p-4" style={{ background: "var(--ok-bg)" }}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--teal-dim)", color: "var(--ok)" }}>
                <IconCheck width={16} height={16} />
              </span>
              <p className="text-sm" style={{ color: "var(--ok)" }}>
                Deltagandet är jämnt fördelat i truppen.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs mb-3" style={{ color: "var(--ink-soft)" }}>
                Färre matcher än 75 % av lagets snitt – prioritera i nästa match:
              </p>
              <ul className="space-y-2">
                {lowParticipation.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                    style={{ background: "var(--warn-bg)" }}
                  >
                    <Avatar name={p.name} size={30} />
                    <span className="flex-1 text-sm font-medium">{p.name.replace(/^Exempel:\s*/, "")}</span>
                    <span className="stat-number text-sm" style={{ color: "var(--warn)" }}>
                      {p.matches_played} {p.matches_played === 1 ? "match" : "matcher"}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* SvFF-principer */}
      <div className="card p-6 md:p-7">
        <p className="eyebrow mb-1">Vår grund</p>
        <h2 className="font-semibold text-[1.05rem] mb-4">SvFF:s riktlinjer som appen bygger på</h2>
        <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
          {SVFF_PRINCIPLES.map((p) => (
            <li key={p} className="flex gap-3 text-sm items-start" style={{ color: "var(--ink-soft)" }}>
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
              >
                <IconCheck width={11} height={11} strokeWidth={2.6} />
              </span>
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
