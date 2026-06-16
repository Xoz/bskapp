import Link from "next/link";
import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getPlayers, getLatestEvaluationDates, getSeasonStats } from "@/lib/queries";
import Avatar from "@/components/Avatar";
import { level as levelInfo } from "@/lib/levels";
import { daysSinceLabel } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const role = await getRole();
  if (role !== "coach") redirect("/matcher");

  const [players, latestEvals, stats] = await Promise.all([
    getPlayers(),
    getLatestEvaluationDates(),
    getSeasonStats(),
  ]);
  const statsById = Object.fromEntries(stats.map((s) => [s.id, s]));
  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Truppen</p>
        <h1 className="text-[1.7rem] font-bold mt-0.5">Spelare</h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
          {players.length} spelare · klicka på en spelare för utvecklingsprofil
        </p>
      </div>

      {/* Highscore-kort */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(
          [
            { label: "Flest mål", key: "goals" },
            { label: "Flest assist", key: "assists" },
            { label: "Flest passningar", key: "passes_completed" },
          ] as { label: string; key: keyof typeof stats[0] }[]
        ).map(({ label, key }) => {
          const top = [...stats]
            .filter((s) => (s[key] as number) > 0)
            .sort((a, b) => (b[key] as number) - (a[key] as number))
            .slice(0, 3);
          return (
            <div key={key as string} className="card p-5">
              <p className="eyebrow mb-3">{label}</p>
              {top.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--ink-faint)" }}>Ingen statistik ännu</p>
              ) : (
                <div className="space-y-2.5">
                  {top.map((s, i) => (
                    <Link key={s.id} href={`/spelare/${s.id}`} className="flex items-center gap-3 group">
                      <span
                        className="stat-number text-xs w-4 shrink-0 text-right"
                        style={{ color: i === 0 ? "var(--accent)" : "var(--ink-faint)" }}
                      >
                        {i + 1}
                      </span>
                      <Avatar name={s.name} jersey={s.jersey_number} size={28} />
                      <span className="flex-1 min-w-0 text-sm font-medium truncate group-hover:underline" style={{ color: "var(--ink)" }}>
                        {s.name.replace(/^Exempel:\s*/, "").split(" ")[0]}
                      </span>
                      <span
                        className="stat-number text-lg shrink-0"
                        style={{ color: i === 0 ? "var(--primary)" : "var(--ink)" }}
                      >
                        {s[key] as number}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Spelare</th>
              <th>Senast utvärderad</th>
              <th>Matcher</th>
              <th>Mål</th>
              <th>Assist</th>
              <th className="hidden md:table-cell">Skott</th>
              <th className="hidden md:table-cell">Skott på mål</th>
              <th className="hidden lg:table-cell">Passningar</th>
              <th className="hidden lg:table-cell">Brytningar</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const s = statsById[p.id];
              return (
                <tr key={p.id}>
                  <td>
                    <Link href={`/spelare/${p.id}`} className="flex items-center gap-3 group">
                      <Avatar name={p.name} jersey={p.jersey_number} size={36} />
                      <span>
                        <span className="flex items-center gap-2 font-medium group-hover:underline" style={{ color: "var(--ink)" }}>
                          {p.name}
                          {(() => {
                            const pl = levelInfo(p.level);
                            return pl ? (
                              <span className="badge level-tag" data-level={pl.id} style={{ background: "var(--bg2)", fontSize: "0.62rem" }}>
                                {pl.short}
                              </span>
                            ) : null;
                          })()}
                        </span>
                        <span className="block text-xs" style={{ color: "var(--ink-faint)" }}>
                          {p.jersey_number != null ? `Tröja #${p.jersey_number}` : "Inget tröjnummer"}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td style={{ color: "var(--ink-soft)" }}>
                    {latestEvals[p.id] ? (
                      daysSinceLabel(latestEvals[p.id])
                    ) : (
                      <span className="badge" style={{ background: "var(--warn-bg)", color: "var(--warn)" }}>
                        Aldrig
                      </span>
                    )}
                  </td>
                  <td>{s?.matches_played ?? 0}</td>
                  <td>{s?.goals ?? 0}</td>
                  <td>{s?.assists ?? 0}</td>
                  <td className="hidden md:table-cell">{s?.shots ?? 0}</td>
                  <td className="hidden md:table-cell">{s?.shots_on_target ?? 0}</td>
                  <td className="hidden lg:table-cell">{s?.passes_completed ?? 0}</td>
                  <td className="hidden lg:table-cell">{s?.interceptions ?? 0}</td>
                  <td className="text-right">
                    <Link href={`/spelare/${p.id}/utvardera`} className="btn-secondary text-sm py-1.5 px-3.5">
                      Utvärdera
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
