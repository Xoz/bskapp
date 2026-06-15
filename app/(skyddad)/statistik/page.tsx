import Link from "next/link";
import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getSeasonStats, getTeamMatchStats } from "@/lib/queries";
import { STAT_FIELDS, STAT_IDS } from "@/lib/stats";
import { LEVELS } from "@/lib/levels";
import ParticipationChart from "@/components/ParticipationChart";
import Avatar from "@/components/Avatar";
import { IconPitch } from "@/components/Icons";

export const dynamic = "force-dynamic";

function outcome(our: number | null, opp: number | null) {
  if (our == null || opp == null) return null;
  if (our > opp) return { letter: "V", label: "Vinst", color: "var(--ok)", bg: "var(--ok-bg)" };
  if (our === opp) return { letter: "O", label: "Oavgjort", color: "var(--ink-soft)", bg: "var(--bg3)" };
  return { letter: "F", label: "Förlust", color: "var(--danger)", bg: "var(--danger-bg)" };
}

export default async function StatsPage() {
  const role = await getRole();
  if (role !== "coach") redirect("/matcher");

  const [stats, teamMatches] = await Promise.all([getSeasonStats(), getTeamMatchStats()]);
  // Alla spelade matcher (för match-för-match-tabellen och resultat/W-D-L)
  const played = teamMatches.length;
  // Bara statistikförda matcher (players_logged > 0) – används i per-match snitt
  const statsMatches = teamMatches.filter((m) => m.players_logged > 0);
  const statsPlayed = statsMatches.length;

  const totals = STAT_IDS.reduce((acc, id) => {
    acc[id] = statsMatches.reduce((s, m) => s + ((m as unknown as Record<string, number>)[id] ?? 0), 0);
    return acc;
  }, {} as Record<string, number>);
  // Mål/insläppta räknas bara för statistikförda matcher (samma nämnare som övriga stats)
  const goalsFor = statsMatches.reduce((s, m) => s + (m.our_score ?? 0), 0);
  const goalsAgainst = statsMatches.reduce((s, m) => s + (m.opponent_score ?? 0), 0);
  const diff = goalsFor - goalsAgainst;
  let wins = 0, draws = 0, losses = 0;
  for (const m of teamMatches) {
    const o = outcome(m.our_score, m.opponent_score);
    if (o?.letter === "V") wins++;
    else if (o?.letter === "O") draws++;
    else if (o?.letter === "F") losses++;
  }

  // Trendvindor: senaste 3 resp. 6 statistikförda matcher (sorterade nyast först)
  const last3 = statsMatches.slice(0, Math.min(3, statsPlayed));
  const last6 = statsMatches.slice(0, Math.min(6, statsPlayed));
  const n3 = last3.length;
  const n6 = last6.length;
  // Trend visas bara när 3m och 6m faktiskt skiljer sig (≥4 matcher)
  const hasTrend = n6 > n3;

  function wdlStr(ms: typeof teamMatches) {
    let w = 0, d = 0, l = 0;
    for (const m of ms) {
      const o = outcome(m.our_score, m.opponent_score);
      if (o?.letter === "V") w++; else if (o?.letter === "O") d++; else if (o?.letter === "F") l++;
    }
    return `${w}–${d}–${l}`;
  }

  function mAvg(ms: typeof teamMatches, get: (m: typeof teamMatches[0]) => number) {
    return ms.length === 0 ? null : ms.reduce((s, m) => s + get(m), 0) / ms.length;
  }

  const f1 = (n: number | null) => (n == null ? "–" : n.toFixed(1));
  const fsgn = (n: number | null) => n == null ? "–" : (n >= 0 ? "+" : "") + n.toFixed(1);
  const pm = (n: number) => (statsPlayed > 0 ? (n / statsPlayed).toFixed(1) : "–");

  type TrendInfo = { sym: "↑" | "↓" | "→"; good: boolean };
  function calcTrend(a3: number | null, a6: number | null, lowerIsBetter = false): TrendInfo | null {
    if (!hasTrend || a3 == null || a6 == null) return null;
    const d = a3 - a6;
    if (Math.abs(d) < 0.05) return { sym: "→", good: true };
    const up = d > 0;
    return { sym: up ? "↑" : "↓", good: lowerIsBetter ? !up : up };
  }

  function sid(id: string) {
    return (m: typeof teamMatches[0]) => ((m as unknown as Record<string, number>)[id] ?? 0);
  }

  interface KpiCard {
    label: string;
    value: string;
    unit?: string;
    color?: string;
    sub?: string;
    trend?: TrendInfo | null;
  }

  const gfA3 = mAvg(last3, m => m.our_score ?? 0);
  const gfA6 = mAvg(last6, m => m.our_score ?? 0);
  const gaA3 = mAvg(last3, m => m.opponent_score ?? 0);
  const gaA6 = mAvg(last6, m => m.opponent_score ?? 0);
  const dfA3 = gfA3 != null && gaA3 != null ? gfA3 - gaA3 : null;
  const dfA6 = gfA6 != null && gaA6 != null ? gfA6 - gaA6 : null;

  function numKpi(label: string, id: string, color?: string, lowerIsBetter = false): KpiCard {
    const a3 = mAvg(last3, sid(id));
    const a6 = mAvg(last6, sid(id));
    return {
      label,
      value: pm(totals[id]),
      unit: "/ m",
      color,
      sub: n3 >= 1 ? (hasTrend ? `3m ${f1(a3)} · 6m ${f1(a6)}` : `3m ${f1(a3)}`) : undefined,
      trend: calcTrend(a3, a6, lowerIsBetter),
    };
  }

  const diffPm = statsPlayed > 0 ? diff / statsPlayed : 0;
  const kpis: KpiCard[] = [
    {
      label: "Matcher",
      value: String(played),
    },
    {
      label: "V – O – F",
      value: `${wins}–${draws}–${losses}`,
      sub: hasTrend
        ? `3m: ${wdlStr(last3)} · 6m: ${wdlStr(last6)}`
        : n3 > 0 ? `3m: ${wdlStr(last3)}` : undefined,
    },
    {
      label: "Mål gjorda",
      value: pm(goalsFor),
      unit: "/ m",
      color: "var(--primary)",
      sub: n3 >= 1 ? (hasTrend ? `3m ${f1(gfA3)} · 6m ${f1(gfA6)}` : `3m ${f1(gfA3)}`) : undefined,
      trend: calcTrend(gfA3, gfA6),
    },
    {
      label: "Insläppta",
      value: pm(goalsAgainst),
      unit: "/ m",
      color: "var(--danger)",
      sub: n3 >= 1 ? (hasTrend ? `3m ${f1(gaA3)} · 6m ${f1(gaA6)}` : `3m ${f1(gaA3)}`) : undefined,
      trend: calcTrend(gaA3, gaA6, true),
    },
    {
      label: "Målskillnad",
      value: diffPm >= 0 ? `+${diffPm.toFixed(1)}` : diffPm.toFixed(1),
      unit: "/ m",
      color: diff > 0 ? "var(--ok)" : diff < 0 ? "var(--danger)" : "var(--ink)",
      sub: n3 >= 1 ? (hasTrend ? `3m ${fsgn(dfA3)} · 6m ${fsgn(dfA6)}` : `3m ${fsgn(dfA3)}`) : undefined,
      trend: calcTrend(dfA3, dfA6),
    },
    numKpi("Assist", "assists"),
    numKpi("Skott på mål", "shots_on_target"),
    numKpi("Passningar", "passes_completed"),
    numKpi("Brytningar", "interceptions"),
    numKpi("Räddningar", "saves"),
  ];

  const average =
    stats.filter((s) => s.matches_played > 0).length > 0
      ? stats.filter((s) => s.matches_played > 0).reduce((a, b) => a + b.matches_played, 0) /
        stats.filter((s) => s.matches_played > 0).length
      : 0;
  const chartData = [...stats]
    .sort((a, b) => b.matches_played - a.matches_played)
    .map((s) => ({ name: s.name.replace(/^Exempel:\s*/, ""), matches: s.matches_played }));

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Säsongen</p>
        <h1 className="text-[1.7rem] font-bold mt-0.5">Statistik</h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
          {played} {played === 1 ? "spelad match" : "spelade matcher"}
          {statsPlayed < played ? ` · ${statsPlayed} statistikförda` : ""}
          {" "}· jämnt deltagande enligt SvFF:s riktlinjer
        </p>
      </div>

      {played === 0 ? (
        <div className="card p-8 text-center">
          <span
            className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full"
            style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
          >
            <IconPitch />
          </span>
          <p className="font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>
            Ingen statistik ännu
          </p>
          <p className="text-sm max-w-sm mx-auto" style={{ color: "var(--ink-soft)" }}>
            När matchstatistik rapporterats ser du lagets siffror, deltagande och resultat här.
          </p>
        </div>
      ) : (
        <>
          {/* KPI-kort: per match-snitt + trendrad */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {kpis.map((k) => (
              <div key={k.label} className="card p-4">
                <p className="eyebrow truncate">{k.label}</p>
                <div className="flex items-baseline gap-1 mt-1.5">
                  <p
                    className="stat-number text-[1.65rem] leading-none tabular-nums"
                    style={{ color: k.color ?? "var(--ink)" }}
                  >
                    {k.value}
                  </p>
                  {k.unit && (
                    <span className="text-[0.58rem] font-medium" style={{ color: "var(--ink-faint)" }}>
                      {k.unit}
                    </span>
                  )}
                </div>
                {(k.sub || k.trend) && (
                  <p
                    className="text-[0.62rem] mt-1.5 tabular-nums leading-snug"
                    style={{ color: "var(--ink-faint)" }}
                  >
                    {k.sub}
                    {k.trend && (
                      <span style={{ color: k.trend.good ? "var(--ok)" : "var(--danger)" }}>
                        {" "}{k.trend.sym}
                      </span>
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Deltagande – kollapsbart för att spara utrymme */}
          <details className="card overflow-hidden">
            <summary
              className="px-6 py-4 flex items-center justify-between cursor-pointer select-none"
              style={{ listStyle: "none" }}
            >
              <div>
                <h2 className="font-semibold">Spelade matcher per spelare</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
                  Röda staplar under 75 % av lagets snitt – prioritera i kommande matcher.
                </p>
              </div>
              <span className="ml-4 text-xs shrink-0" style={{ color: "var(--ink-soft)" }}>
                Visa ▾
              </span>
            </summary>
            <div
              className="px-6 pb-6 pt-2"
              style={{ borderTop: "1px solid var(--line)" }}
            >
              <ParticipationChart data={chartData} average={average} />
            </div>
          </details>

          {/* Match för match */}
          <div className="card overflow-hidden">
            <div className="px-6 py-5" style={{ borderBottom: "1px solid var(--line)" }}>
              <h2 className="font-semibold">Match för match</h2>
              <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
                Resultat och lagets rapporterade statistik per match.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Match</th>
                    <th>Resultat</th>
                    {STAT_FIELDS.map((f) => (
                      <th key={f.id} title={f.label}>{f.short}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teamMatches.map((m) => {
                    const row = m as unknown as Record<string, number>;
                    const o = outcome(m.our_score, m.opponent_score);
                    const lvl = LEVELS.find((l) => l.id === m.level);
                    return (
                      <tr key={m.id}>
                        <td>
                          <Link
                            href={`/matcher/${m.id}`}
                            className="font-medium whitespace-nowrap hover:underline"
                            style={{ color: "var(--primary)" }}
                          >
                            {m.home_away === "home" ? "" : "@ "}{m.opponent}
                          </Link>
                          <span className="block text-[0.7rem]" style={{ color: "var(--ink-faint)" }}>
                            {m.date}
                            {m.cup_name ? ` · 🏆 ${m.cup_name}` : ""}
                            {lvl ? ` · ${lvl.label}` : ""}
                          </span>
                        </td>
                        <td>
                          {o ? (
                            <span className="inline-flex items-center gap-2 whitespace-nowrap">
                              <span
                                className="stat-number flex h-5 w-5 items-center justify-center rounded text-[0.65rem]"
                                style={{ background: o.bg, color: o.color }}
                                title={o.label}
                              >
                                {o.letter}
                              </span>
                              <span className="stat-number">{m.our_score}–{m.opponent_score}</span>
                            </span>
                          ) : (
                            <span style={{ color: "var(--ink-faint)" }}>–</span>
                          )}
                        </td>
                        {m.players_logged === 0 ? (
                          <td colSpan={STAT_FIELDS.length} style={{ color: "var(--ink-faint)", fontStyle: "italic", fontSize: "0.75rem" }}>
                            ej statistikförd
                          </td>
                        ) : STAT_FIELDS.map((f) => (
                          <td key={f.id}>{row[f.id] || 0}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--line-strong)", fontWeight: 600 }}>
                    <td>Totalt</td>
                    <td className="stat-number whitespace-nowrap">{goalsFor}–{goalsAgainst}</td>
                    {STAT_FIELDS.map((f) => (
                      <td key={f.id}>{totals[f.id]}</td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Säsongens siffror per spelare */}
          <div className="card overflow-hidden">
            <div className="px-6 py-5" style={{ borderBottom: "1px solid var(--line)" }}>
              <h2 className="font-semibold">Säsongens siffror per spelare</h2>
              <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
                {STAT_FIELDS.map((f) => `${f.short} = ${f.label}`).join(" · ")}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Spelare</th>
                    <th>Matcher</th>
                    {STAT_FIELDS.map((f) => (
                      <th key={f.id} title={f.label}>{f.short}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s) => {
                    const row = s as unknown as Record<string, number>;
                    return (
                      <tr key={s.id}>
                        <td>
                          <span className="flex items-center gap-2.5 font-medium whitespace-nowrap">
                            <Avatar name={s.name} jersey={s.jersey_number} size={30} />
                            {s.name}
                          </span>
                        </td>
                        <td>{s.matches_played}</td>
                        {STAT_FIELDS.map((f) => (
                          <td key={f.id}>{row[f.id] || 0}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <p className="text-xs max-w-xl" style={{ color: "var(--ink-faint)" }}>
        Statistiken visas som stöd för tränarna – använd den aldrig för att ranka spelare. I
        barnfotbollen är utveckling och glädje viktigare än resultat.
      </p>
    </div>
  );
}
