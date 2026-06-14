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

// Resultat (V/O/F) för en match med känt resultat
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
  const played = teamMatches.length;

  // Lagtotaler över spelade matcher
  const totals = STAT_IDS.reduce((acc, id) => {
    acc[id] = teamMatches.reduce((s, m) => s + ((m as unknown as Record<string, number>)[id] ?? 0), 0);
    return acc;
  }, {} as Record<string, number>);
  const goalsFor = teamMatches.reduce((s, m) => s + (m.our_score ?? 0), 0);
  const goalsAgainst = teamMatches.reduce((s, m) => s + (m.opponent_score ?? 0), 0);
  const diff = goalsFor - goalsAgainst;
  let wins = 0, draws = 0, losses = 0;
  for (const m of teamMatches) {
    const o = outcome(m.our_score, m.opponent_score);
    if (o?.letter === "V") wins++;
    else if (o?.letter === "O") draws++;
    else if (o?.letter === "F") losses++;
  }

  // KPI-kort. Ackvärden över hela säsongen, små och avläsbara på en blick.
  const kpis: { label: string; value: string | number; color?: string }[] = [
    { label: "Matcher", value: played },
    { label: "V – O – F", value: `${wins}–${draws}–${losses}` },
    { label: "Mål gjorda", value: goalsFor, color: "var(--primary)" },
    { label: "Insläppta", value: goalsAgainst, color: "var(--danger)" },
    {
      label: "Målskillnad",
      value: diff > 0 ? `+${diff}` : `${diff}`,
      color: diff > 0 ? "var(--ok)" : diff < 0 ? "var(--danger)" : "var(--ink)",
    },
    { label: "Assist", value: totals.assists },
    { label: "Skott på mål", value: totals.shots_on_target },
    { label: "Passningar", value: totals.passes_completed },
    { label: "Brytningar", value: totals.interceptions },
    { label: "Räddningar", value: totals.saves },
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
          {played} {played === 1 ? "spelad match" : "spelade matcher"} · jämnt deltagande enligt
          SvFF:s riktlinjer
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
          {/* KPI-kort */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {kpis.map((k) => (
              <div key={k.label} className="card p-4">
                <p className="eyebrow truncate">{k.label}</p>
                <p
                  className="stat-number text-[1.7rem] leading-none mt-1.5 tabular-nums"
                  style={{ color: k.color ?? "var(--ink)" }}
                >
                  {k.value}
                </p>
              </div>
            ))}
          </div>

          {/* Deltagande */}
          <div className="card p-6 md:p-7">
            <h2 className="font-semibold mb-1">Spelade matcher per spelare</h2>
            <p className="text-xs mb-5" style={{ color: "var(--ink-faint)" }}>
              Röda staplar ligger under 75 % av lagets snitt – prioritera dem i kommande matcher.
            </p>
            <ParticipationChart data={chartData} average={average} />
          </div>

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
                        {STAT_FIELDS.map((f) => (
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
