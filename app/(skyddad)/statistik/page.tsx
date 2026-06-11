import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getSeasonStats, getMatches } from "@/lib/queries";
import PlaytimeChart from "@/components/PlaytimeChart";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const role = await getRole();
  if (role !== "coach") redirect("/matcher");

  const stats = getSeasonStats();
  const matches = getMatches();

  const withMinutes = stats.filter((s) => s.total_minutes > 0);
  const average =
    withMinutes.length > 0
      ? withMinutes.reduce((a, b) => a + b.total_minutes, 0) / withMinutes.length
      : 0;

  const chartData = [...stats]
    .sort((a, b) => b.total_minutes - a.total_minutes)
    .map((s) => ({ name: s.name.replace(/^Exempel: /, ""), minutes: s.total_minutes }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Statistik</h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
          {matches.length} matcher · Fokus på jämn speltid enligt SvFF:s riktlinjer
        </p>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold mb-1">Speltid per spelare</h2>
        <p className="text-xs mb-4" style={{ color: "var(--ink-soft)" }}>
          Gula staplar ligger under 75 % av lagets snitt – prioritera dem i kommande matcher.
        </p>
        {matches.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            Registrera matcher för att se speltidsfördelningen.
          </p>
        ) : (
          <PlaytimeChart data={chartData} average={average} />
        )}
      </div>

      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Spelare</th>
              <th>Matcher</th>
              <th>Speltid</th>
              <th>Snitt/match</th>
              <th>Mål</th>
              <th>Assist</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.id}>
                <td className="font-medium">
                  {s.jersey_number != null && (
                    <span className="mr-1.5" style={{ color: "var(--ink-soft)" }}>#{s.jersey_number}</span>
                  )}
                  {s.name}
                </td>
                <td>{s.matches_played}</td>
                <td>{s.total_minutes} min</td>
                <td>
                  {s.matches_played > 0 ? `${Math.round(s.total_minutes / s.matches_played)} min` : "–"}
                </td>
                <td>{s.total_goals}</td>
                <td>{s.total_assists}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
        Mål och assist visas som stöd för tränarna – använd dem aldrig för att ranka spelare.
        I barnfotbollen är utveckling och glädje viktigare än resultat.
      </p>
    </div>
  );
}
