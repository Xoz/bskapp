import { saveMatch } from "@/lib/actions";
import type { Match, MatchPlayerRow, Player } from "@/lib/queries";
import { GAME_FORMAT } from "@/lib/svff";
import Avatar from "@/components/Avatar";
import Link from "next/link";

export default function MatchForm({
  players,
  match,
  matchPlayers,
}: {
  players: Player[];
  match?: Match;
  matchPlayers?: MatchPlayerRow[];
}) {
  const byPlayer = Object.fromEntries((matchPlayers ?? []).map((mp) => [mp.player_id, mp]));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={saveMatch} className="space-y-6">
      {match && <input type="hidden" name="id" value={match.id} />}

      <div className="card p-6 grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="date">Datum</label>
          <input id="date" name="date" type="date" required defaultValue={match?.date ?? today} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="opponent">Motståndare</label>
          <input id="opponent" name="opponent" required defaultValue={match?.opponent ?? ""} className="input" placeholder="T.ex. Väsby IK F2014" />
        </div>
        <div>
          <label className="label" htmlFor="home_away">Hemma/borta</label>
          <select id="home_away" name="home_away" defaultValue={match?.home_away ?? "home"} className="input">
            <option value="home">Hemma</option>
            <option value="away">Borta</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="match_type">Matchtyp</label>
          <select id="match_type" name="match_type" defaultValue={match?.match_type ?? "seriespel"} className="input">
            <option value="seriespel">Sammandrag/serie</option>
            <option value="cup">Cup</option>
            <option value="traningsmatch">Träningsmatch</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="our_score">Våra mål (frivilligt)</label>
          <input id="our_score" name="our_score" type="number" min="0" defaultValue={match?.our_score ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="opponent_score">Motståndarens mål (frivilligt)</label>
          <input id="opponent_score" name="opponent_score" type="number" min="0" defaultValue={match?.opponent_score ?? ""} className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="notes">Anteckningar</label>
          <textarea id="notes" name="notes" rows={2} defaultValue={match?.notes ?? ""} className="input" placeholder="T.ex. vad laget tränade på i matchen" />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-6 py-5" style={{ borderBottom: "1px solid var(--line)" }}>
          <h2 className="font-semibold">Spelarstatistik</h2>
          <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
            Spelform {GAME_FORMAT.format} · {GAME_FORMAT.periods} = max {GAME_FORMAT.totalMinutes} min
            per spelare. Bocka i de som spelade och fyll i speltid.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Spelade</th>
                <th>Spelare</th>
                <th>Minuter</th>
                <th>Mål</th>
                <th>Assist</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const mp = byPlayer[p.id];
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
                      <span className="flex items-center gap-2.5 font-medium">
                        <Avatar name={p.name} size={30} />
                        {p.name}
                      </span>
                    </td>
                    <td>
                      <input
                        type="number"
                        name={`minutes_${p.id}`}
                        min="0"
                        max={GAME_FORMAT.totalMinutes}
                        defaultValue={mp?.minutes ?? ""}
                        placeholder="0"
                        className="input w-20"
                        aria-label={`Minuter för ${p.name}`}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        name={`goals_${p.id}`}
                        min="0"
                        defaultValue={mp?.goals ?? ""}
                        placeholder="0"
                        className="input w-16"
                        aria-label={`Mål för ${p.name}`}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        name={`assists_${p.id}`}
                        min="0"
                        defaultValue={mp?.assists ?? ""}
                        placeholder="0"
                        className="input w-16"
                        aria-label={`Assist för ${p.name}`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex gap-3">
        <button type="submit" className="btn-primary px-6">Spara match</button>
        <Link href="/matcher" className="btn-secondary">Avbryt</Link>
      </div>
    </form>
  );
}
