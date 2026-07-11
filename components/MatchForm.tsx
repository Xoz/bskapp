import { saveMatch } from "@/lib/actions";
import type { Match, MatchPlayerRow, Player } from "@/lib/queries";
import { STAT_FIELDS } from "@/lib/stats";
import { LEVELS } from "@/lib/levels";
import StatsFields from "@/components/StatsFields";
import Link from "next/link";
import { swedishToday } from "@/lib/dates";
import type { OrganizationGroup } from "@/lib/organization";

export default function MatchForm({
  players,
  match,
  matchPlayers,
  groups = [],
}: {
  players: Player[];
  match?: Match;
  matchPlayers?: MatchPlayerRow[];
  groups?: OrganizationGroup[];
}) {
  const today = swedishToday();

  return (
    <form action={saveMatch} className="space-y-6">
      {match && <input type="hidden" name="id" value={match.id} />}

      <div className="card p-6 grid gap-5 sm:grid-cols-2">
        {groups.length > 0 && (
          <div className="sm:col-span-2">
            <label className="label" htmlFor="group_id">Lag eller matchgrupp</label>
            <select id="group_id" name="group_id" defaultValue={match?.group_id ?? groups[0]?.id ?? ""} className="input" required>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}{group.group_type === "matchgroup" && group.cup_name ? ` · ${group.cup_name}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="date">Datum</label>
          <input id="date" name="date" type="date" required defaultValue={match?.date ?? today} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="start_time">Avsparktid <span style={{ fontWeight: 400, opacity: 0.6 }}>(frivilligt)</span></label>
          <input id="start_time" name="start_time" type="time" defaultValue={match?.start_time ?? ""} className="input" />
          <p className="caption mt-1" style={{ color: "var(--ink-muted)" }}>Rapportering öppnar 15 min innan</p>
        </div>
        <div>
          <label className="label" htmlFor="periods">Antal perioder</label>
          <select id="periods" name="periods" defaultValue={match?.periods ?? 3} className="input">
            <option value={2}>2 perioder (cup)</option>
            <option value={3}>3 perioder (serie)</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="period_minutes">Minuter per period</label>
          <input id="period_minutes" name="period_minutes" type="number" min="5" max="60" defaultValue={match?.period_minutes ?? 20} className="input" />
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
            <option value="seriespel">Sanktan</option>
            <option value="cup">Cup</option>
            <option value="traningsmatch">Träningsmatch</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="level">Svårighetsnivå</label>
          <select id="level" name="level" defaultValue={match?.level ?? ""} className="input">
            <option value="">Ej satt</option>
            {LEVELS.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
          <p className="caption mt-1" style={{ color: "var(--ink-muted)" }}>Styr laguttagningen</p>
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
          <label className="label" htmlFor="location">Plats <span style={{ fontWeight: 400, opacity: 0.6 }}>(frivilligt)</span></label>
          <input id="location" name="location" defaultValue={match?.location ?? ""} className="input" placeholder="T.ex. Bollstanäs IP 21" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="notes">Anteckningar</label>
          <textarea id="notes" name="notes" rows={2} defaultValue={match?.notes ?? ""} className="input" placeholder="T.ex. vad laget tränade på i matchen" />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-6 py-5" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="font-semibold body">Spelarstatistik</h2>
          <p className="caption mt-1" style={{ color: "var(--ink-muted)" }}>
            {STAT_FIELDS.map((f) => `${f.short} = ${f.label}`).join(" · ")}
          </p>
        </div>
        <StatsFields players={players} matchPlayers={matchPlayers} />
      </div>

      <div className="flex gap-3">
        <button type="submit" className="btn-primary">Spara match</button>
        <Link href="/matcher" className="btn-secondary">Avbryt</Link>
      </div>
    </form>
  );
}
