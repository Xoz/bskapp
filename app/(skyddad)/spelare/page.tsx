import Link from "next/link";
import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getPlayers, getLatestEvaluationDates, getSeasonStats } from "@/lib/queries";
import { addPlayer, addPlayersBulk, removeDemoPlayers } from "@/lib/actions";
import Avatar from "@/components/Avatar";
import { IconPlus, IconAlert } from "@/components/Icons";

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
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow">Truppen</p>
          <h1 className="text-[1.7rem] font-bold mt-0.5">Spelare</h1>
          <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
            {players.length} spelare · klicka på en spelare för utvecklingsprofil
          </p>
        </div>
        <form action={addPlayer} className="card flex gap-2 items-end p-3">
          <div>
            <label className="label" htmlFor="name">Namn</label>
            <input id="name" name="name" required className="input w-44" placeholder="Förnamn Efternamn" />
          </div>
          <div>
            <label className="label" htmlFor="jersey_number">Nr</label>
            <input id="jersey_number" name="jersey_number" type="number" min="1" max="99" className="input w-16" />
          </div>
          <button type="submit" className="btn-primary">
            <IconPlus width={15} height={15} /> Lägg till
          </button>
        </form>
      </div>

      {hasDemo && (
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm flex-wrap"
          style={{ background: "var(--warn-bg)", color: "var(--warn)", border: "1px solid color-mix(in srgb, var(--warn), transparent 75%)" }}
        >
          <IconAlert width={17} height={17} />
          <span className="flex-1 min-w-48">
            Truppen innehåller exempelspelare – klistra in din riktiga trupp nedan och rensa sedan
            exemplen.
          </span>
          <form action={removeDemoPlayers}>
            <button type="submit" className="font-semibold underline cursor-pointer">
              Ta bort alla exempelspelare
            </button>
          </form>
        </div>
      )}

      {/* Klistra in truppen från svenskalag.se */}
      <details className="card p-5">
        <summary
          className="cursor-pointer font-semibold text-sm select-none"
          style={{ fontFamily: "var(--font-display)", color: "var(--primary)" }}
        >
          Klistra in hela truppen från svenskalag.se
        </summary>
        <form action={addPlayersBulk} className="mt-4 space-y-3">
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            Truppsidan på svenskalag.se kräver inloggning, så kopiera namnlistan därifrån när du är
            inloggad och klistra in här – ett namn per rad. Tröjnummer före eller efter namnet
            plockas upp automatiskt (t.ex. &quot;7 Alva Svensson&quot;). Dubbletter hoppas över.
          </p>
          <textarea
            name="names"
            rows={8}
            required
            className="input font-mono text-sm"
            placeholder={"Alva Svensson\nEbba Karlsson 5\n7 Maja Lindqvist"}
          />
          <button type="submit" className="btn-primary">Lägg till spelarna</button>
        </form>
      </details>

      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Spelare</th>
              <th>Senast utvärderad</th>
              <th>Matcher</th>
              <th>Mål</th>
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
                      <Avatar name={p.name} size={36} />
                      <span>
                        <span className="block font-medium group-hover:underline" style={{ color: "var(--ink)" }}>
                          {p.name}
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
