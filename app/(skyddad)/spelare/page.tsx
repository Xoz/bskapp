import Link from "next/link";
import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getPlayers, getLatestEvaluationDates, getSeasonStats } from "@/lib/queries";
import Avatar from "@/components/Avatar";
import { level as levelInfo } from "@/lib/levels";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const role = await getRole();
  if (role !== "coach") redirect("/matcher");

  const players = await getPlayers();
  const latestEvals = await getLatestEvaluationDates();
  const stats = await getSeasonStats();
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
                              <span className="badge" style={{ background: "var(--bg2)", color: pl.color, fontSize: "0.62rem" }}>
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
                    {latestEvals[p.id] ?? (
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
