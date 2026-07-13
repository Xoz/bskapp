import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getRole, hasPermission } from "@/lib/auth";
import { getPlayers, getLatestEvaluationDates, getSeasonStats } from "@/lib/queries";
import { FEATURES } from "@/lib/features";
import Avatar from "@/components/Avatar";
import SpelareTabs from "@/components/SpelareTabs";
import { level as levelInfo } from "@/lib/levels";
import { daysSinceLabel } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const role = await getRole();
  if (role !== "coach") redirect("/matcher");

  const [players, latestEvals, stats, canEvaluate, canViewPrivate, canViewInterviews, user] = await Promise.all([
    getPlayers(),
    getLatestEvaluationDates(),
    getSeasonStats(),
    hasPermission("manage_evaluations"),
    hasPermission("view_private_player_data"),
    hasPermission("view_interviews"),
    getCurrentUser(),
  ]);
  const statsById = Object.fromEntries(stats.map((s) => [s.id, s]));
  return (
    <div className="space-y-6">
      <SpelareTabs canViewInterviews={canViewInterviews} />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow">Truppen</p>
          <h1 className="mt-1" style={{ fontSize: "40px" }}>Spelare</h1>
          <p className="body-small mt-1" style={{ color: "var(--ink-secondary)" }}>
            {players.length} spelare · klicka på en spelare för utvecklingsprofil
          </p>
        </div>
        <Link href="/utveckling" className="btn-secondary btn-sm shrink-0">
          🪜 Lagets utvecklingsträd
        </Link>
      </div>

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Spelare</th>
              <th>Senast utvärderad</th>
              {FEATURES.matchStats && (<>
                <th>Matcher</th>
                <th>Mål</th>
                <th>Assist</th>
                <th className="hidden md:table-cell">Skott</th>
                <th className="hidden md:table-cell">Skott på mål</th>
                <th className="hidden lg:table-cell">Passningar</th>
                <th className="hidden lg:table-cell">Brytningar</th>
              </>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const s = statsById[p.id];
              return (
                <tr key={p.id}>
                  <td>
                    <Link href={canViewPrivate ? `/spelare/${p.id}` : "#"} className="flex items-center gap-3 group">
                      <Avatar name={p.name} jersey={p.jersey_number} size={36} />
                      <span>
                        <span className="flex items-center gap-2 font-medium group-hover:underline body" style={{ color: "var(--ink)" }}>
                          {p.name}
                          {(() => {
                            const pl = levelInfo(p.level);
                            return pl ? (
                              <span className="badge level-tag" data-level={pl.id} style={{ background: "var(--elevated)" }}>
                                {pl.short}
                              </span>
                            ) : null;
                          })()}
                        </span>
                        <span className="block caption" style={{ color: "var(--ink-muted)" }}>
                          {p.jersey_number != null ? `Tröja #${p.jersey_number}` : "Inget tröjnummer"}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td style={{ color: "var(--ink-secondary)" }}>
                    {latestEvals[p.id] ? (
                      daysSinceLabel(latestEvals[p.id])
                    ) : (
                      <span className="badge badge-warning">
                        Aldrig
                      </span>
                    )}
                  </td>
                  {FEATURES.matchStats && (<>
                    <td>{s?.matches_played ?? 0}</td>
                    <td>{s?.goals ?? 0}</td>
                    <td>{s?.assists ?? 0}</td>
                    <td className="hidden md:table-cell">{s?.shots ?? 0}</td>
                    <td className="hidden md:table-cell">{s?.shots_on_target ?? 0}</td>
                    <td className="hidden lg:table-cell">{s?.passes_completed ?? 0}</td>
                    <td className="hidden lg:table-cell">{s?.interceptions ?? 0}</td>
                  </>)}
                  <td className="text-right">
                    {canEvaluate && <Link href={`/spelare/${p.id}/utvardera`} className="btn-secondary btn-sm">Utvärdera</Link>}
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
