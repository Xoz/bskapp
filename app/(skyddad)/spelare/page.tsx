import Link from "next/link";
import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getPlayers, getLatestEvaluationDates, getSeasonStats } from "@/lib/queries";
import { addPlayer } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const role = await getRole();
  if (role !== "coach") redirect("/matcher");

  const players = getPlayers();
  const latestEvals = getLatestEvaluationDates();
  const stats = getSeasonStats();
  const statsById = Object.fromEntries(stats.map((s) => [s.id, s]));
  const hasDemo = players.some((p) => p.name.startsWith("Exempel:"));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Spelare</h1>
          <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
            {players.length} spelare i truppen
          </p>
        </div>
        <form action={addPlayer} className="flex gap-2 items-end">
          <div>
            <label className="label" htmlFor="name">Namn</label>
            <input id="name" name="name" required className="input w-44" placeholder="Förnamn Efternamn" />
          </div>
          <div>
            <label className="label" htmlFor="jersey_number">Nr</label>
            <input id="jersey_number" name="jersey_number" type="number" min="1" max="99" className="input w-16" />
          </div>
          <button type="submit" className="btn-primary">Lägg till</button>
        </form>
      </div>

      {hasDemo && (
        <div className="card p-4 border-amber-200 bg-amber-50 text-sm text-amber-800">
          Listan innehåller exempelspelare. Klicka på en spelare för att byta namn till en riktig
          spelare, eller ta bort den från spelarens sida.
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Namn</th>
              <th>Senast utvärderad</th>
              <th>Matcher</th>
              <th>Speltid</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const s = statsById[p.id];
              return (
                <tr key={p.id}>
                  <td className="font-semibold" style={{ color: "var(--ink-soft)" }}>
                    {p.jersey_number ?? "–"}
                  </td>
                  <td>
                    <Link href={`/spelare/${p.id}`} className="font-medium hover:underline" style={{ color: "var(--primary)" }}>
                      {p.name}
                    </Link>
                  </td>
                  <td style={{ color: "var(--ink-soft)" }}>
                    {latestEvals[p.id] ?? <span className="text-amber-600 font-medium">Aldrig</span>}
                  </td>
                  <td>{s?.matches_played ?? 0}</td>
                  <td>{s?.total_minutes ?? 0} min</td>
                  <td className="text-right">
                    <Link href={`/spelare/${p.id}/utvardera`} className="btn-secondary text-sm py-1.5 px-3">
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
