import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getMatch, getPlayersLevelInfo, getMatchSquad, getMatchLineup, getMatchesByCup } from "@/lib/queries";
import { LEVELS, level as levelInfo, fit } from "@/lib/levels";
import { setMatchLevel } from "@/lib/actions";
import SquadBoard from "@/components/SquadBoard";
import { IconArrowLeft } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function SquadPage({ params }: { params: Promise<{ id: string }> }) {
  const role = await getRole();
  if (role !== "coach") redirect("/matcher");

  const { id } = await params;
  const match = await getMatch(Number(id));
  if (!match) notFound();

  const [playersInfo, squadIds, lineup, cupMatches] = await Promise.all([
    getPlayersLevelInfo(),
    getMatchSquad(match.id),
    getMatchLineup(match.id),
    getMatchesByCup(match.cup_name),
  ]);
  const mLevel = levelInfo(match.level);
  const cupSize = cupMatches.length;

  // Sortera trupplistan så de som passar matchnivån bäst kommer först
  const sortedPlayers = [...playersInfo].sort(
    (a, b) =>
      fit(a.level, match.level).order - fit(b.level, match.level).order ||
      a.name.localeCompare(b.name, "sv")
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          href={`/matcher/${match.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-[var(--primary)]"
          style={{ color: "var(--ink-soft)", fontFamily: "var(--font-display)" }}
        >
          <IconArrowLeft width={15} height={15} /> Tillbaka till matchen
        </Link>
        <h1 className="text-[1.6rem] font-bold mt-2">Laguttagning</h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
          {match.home_away === "home" ? "Hemma mot" : "Borta mot"} {match.opponent} · {match.date}
          {match.start_time ? ` · ${match.start_time}` : ""}
          {mLevel && <> · <strong style={{ color: mLevel.color }}>{mLevel.label}</strong></>}
        </p>
      </div>

      {/* Matchnivå – styr färgkodningen i trupplistan */}
      <form action={setMatchLevel} className="card p-5 space-y-3" style={{ background: "var(--primary-ghost)" }}>
        <input type="hidden" name="id" value={match.id} />
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex-1 min-w-48">
            <label className="label" htmlFor="level">
              {cupSize > 1 ? "Cupens svårighetsnivå" : "Matchens svårighetsnivå"}
            </label>
            <select id="level" name="level" defaultValue={match.level ?? ""} className="input">
              <option value="">Ej satt</option>
              {LEVELS.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-secondary">Spara nivå</button>
        </div>
        {cupSize > 1 && (
          <label className="flex items-center gap-2.5 text-sm cursor-pointer">
            <input type="checkbox" name="apply_cup" defaultChecked className="h-4 w-4 rounded accent-[var(--primary)]" />
            Gäller alla {cupSize} matcher i {match.cup_name}
          </label>
        )}
      </form>

      {playersInfo.length === 0 ? (
        <div className="card p-6 text-sm" style={{ color: "var(--ink-soft)" }}>
          Inga aktiva spelare i truppen ännu.
        </div>
      ) : (
        <SquadBoard
          matchId={match.id}
          matchLevel={match.level}
          players={sortedPlayers.map((p) => ({
            id: p.id,
            name: p.name,
            jersey_number: p.jersey_number,
            position: p.position,
            level: p.level,
          }))}
          initialSquad={squadIds}
          initialFormation={match.formation}
          initialPositions={lineup}
          cupSize={cupSize}
          cupName={match.cup_name}
        />
      )}

      <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
        Kalla in spelare i trupplistan (färgen visar hur de passar matchnivån), dra upp dem på planen
        till startelvan och spara. Spelnivån sätts per spelare under deras profil.
      </p>
    </div>
  );
}
