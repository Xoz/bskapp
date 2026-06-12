import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getSeasonStats, getMatches } from "@/lib/queries";
import { STAT_FIELDS } from "@/lib/stats";
import ParticipationChart from "@/components/ParticipationChart";
import Avatar from "@/components/Avatar";
import { IconPitch } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const role = await getRole();
  if (role !== "coach") redirect("/matcher");

  const stats = getSeasonStats();
  const matches = getMatches();

  const playing = stats.filter((s) => s.matches_played > 0);
  const average =
    playing.length > 0
      ? playing.reduce((a, b) => a + b.matches_played, 0) / playing.length
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
          {matches.length} {matches.length === 1 ? "match" : "matcher"} · jämnt deltagande enligt
          SvFF:s riktlinjer
        </p>
      </div>

      <div className="card p-6 md:p-7">
        <h2 className="font-semibold mb-1">Spelade matcher per spelare</h2>
        <p className="text-xs mb-5" style={{ color: "var(--ink-faint)" }}>
          Gula staplar ligger under 75 % av lagets snitt – prioritera dem i kommande matcher.
        </p>
        {matches.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: "var(--line-strong)" }}>
            <span
              className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full"
              style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
            >
              <IconPitch />
            </span>
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
              När matchstatistik rapporterats ser du deltagandet här.
            </p>
          </div>
        ) : (
          <ParticipationChart data={chartData} average={average} />
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="px-6 py-5" style={{ borderBottom: "1px solid var(--line)" }}>
          <h2 className="font-semibold">Säsongens siffror</h2>
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
                        <Avatar name={s.name} size={30} />
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

      <p className="text-xs max-w-xl" style={{ color: "var(--ink-faint)" }}>
        Statistiken visas som stöd för tränarna – använd den aldrig för att ranka spelare. I
        barnfotbollen är utveckling och glädje viktigare än resultat.
      </p>
    </div>
  );
}
