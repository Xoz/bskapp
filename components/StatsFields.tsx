import type { MatchPlayerRow, Player } from "@/lib/queries";
import { STAT_FIELDS } from "@/lib/stats";
import Avatar from "@/components/Avatar";

// Spelartabell med statistikfält – används av tränarens matchformulär
// och den publika rapporteringen med matchkod
export default function StatsFields({
  players,
  matchPlayers,
}: {
  players: Player[];
  matchPlayers?: MatchPlayerRow[];
}) {
  const byPlayer = Object.fromEntries((matchPlayers ?? []).map((mp) => [mp.player_id, mp]));

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Spelade</th>
            <th>Spelare</th>
            {STAT_FIELDS.map((f) => (
              <th key={f.id} title={f.label}>
                {f.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const mp = byPlayer[p.id] as unknown as Record<string, number> | undefined;
            return (
              <tr key={p.id}>
                <td>
                  <input
                    type="checkbox"
                    name={`played_${p.id}`}
                    defaultChecked={!!mp}
                    className="h-5 w-5 rounded accent-[var(--primary)]"
                    aria-label={`${p.name} spelade`}
                  />
                </td>
                <td>
                  <span className="flex items-center gap-2.5 font-medium whitespace-nowrap">
                    <Avatar name={p.name} size={30} />
                    {p.name}
                  </span>
                </td>
                {STAT_FIELDS.map((f) => (
                  <td key={f.id}>
                    <input
                      type="number"
                      name={`${f.id}_${p.id}`}
                      min="0"
                      defaultValue={mp?.[f.id] || ""}
                      placeholder="0"
                      className="input w-14 px-2 text-center"
                      aria-label={`${f.label} för ${p.name}`}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
