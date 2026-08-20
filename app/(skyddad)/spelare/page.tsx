import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { getPlayerCoreSummaries } from "@/lib/developmentCore";
import PlayerDirectory from "@/components/PlayerDirectory";

export const dynamic = "force-dynamic";

const TEAM_ORDER = ["Gul", "Grön", "F15"];
const TEAM_TONES: Record<string, "yellow" | "green" | "blue"> = { Gul: "yellow", Grön: "green", F15: "blue" };
const UNASSIGNED_TEAM = "utan-lag";

export default async function PlayersPage({ searchParams }: {
  searchParams: Promise<{ lag?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.primaryRole)) redirect("/mina-spelare");
  if (!user.permissions.includes("view_players")) redirect("/idag?behorighet=saknas");
  const players = await getPlayerCoreSummaries();
  const requestedTeam = (await searchParams).lag;
  const teamNames = [...new Set(players.flatMap(({ teams }) => teams.map((team) => team.name)))].sort((a, b) => {
    const aRank = TEAM_ORDER.indexOf(a);
    const bRank = TEAM_ORDER.indexOf(b);
    if (aRank !== -1 || bRank !== -1) return (aRank === -1 ? TEAM_ORDER.length : aRank) - (bRank === -1 ? TEAM_ORDER.length : bRank);
    return a.localeCompare(b, "sv");
  });
  const hasUnassigned = players.some(({ teams }) => teams.length === 0);
  const selectedTeam = typeof requestedTeam === "string" && (teamNames.includes(requestedTeam) || (requestedTeam === UNASSIGNED_TEAM && hasUnassigned))
    ? requestedTeam
    : null;
  const visiblePlayers = selectedTeam === UNASSIGNED_TEAM
    ? players.filter(({ teams }) => teams.length === 0)
    : selectedTeam
      ? players.filter(({ teams }) => teams.some((team) => team.name === selectedTeam))
      : players;
  const teamCount = (teamName: string) => players.filter(({ teams }) => teams.some((team) => team.name === teamName)).length;

  return (
    <div className="core-page">
      <header className="core-header">
        <div className="core-header-copy">
        <p className="core-kicker">Individuell utveckling</p>
        <h1 className="core-title">Spelare</h1>
        <p className="core-lead">
          Sök fram en spelare för att se matchpreferenser, utvecklingsmål och matchhistorik.
        </p>
        </div>
        <div className="core-panel px-4 py-3 text-right">
          <strong className="block text-xl">{visiblePlayers.length}</strong>
          <span className="core-section-note">{selectedTeam ? `av ${players.length} aktiva spelare` : "aktiva spelare"}</span>
        </div>
      </header>
      <nav className="core-team-filters" aria-label="Filtrera spelare efter lagtillhörighet">
        <Link href="/spelare" className={`core-team-filter ${selectedTeam === null ? "core-team-filter-active" : ""}`}>
          Alla <span>{players.length}</span>
        </Link>
        {teamNames.map((teamName) => (
          <Link
            key={teamName}
            href={`/spelare?lag=${encodeURIComponent(teamName)}`}
            className={`core-team-filter ${selectedTeam === teamName ? "core-team-filter-active" : ""}`}
            data-team-tone={TEAM_TONES[teamName]}
          >
            {teamName} <span>{teamCount(teamName)}</span>
          </Link>
        ))}
        {hasUnassigned && (
          <Link
            href={`/spelare?lag=${UNASSIGNED_TEAM}`}
            className={`core-team-filter ${selectedTeam === UNASSIGNED_TEAM ? "core-team-filter-active" : ""}`}
          >
            Ej tilldelat <span>{players.filter(({ teams }) => teams.length === 0).length}</span>
          </Link>
        )}
      </nav>
      <PlayerDirectory players={visiblePlayers.map(({ player, teams, goals, matchCount, callupCount }) => ({
        id: player.id,
        name: player.name,
        jersey: player.jersey_number,
        teams: teams.map(({ id, name }) => ({ id, name })),
        goals: goals.map((goal) => goal.title),
        matchCount,
        callupCount,
        positionPrimary: player.preferred_position_primary,
        positionSecondary: player.preferred_position_secondary,
        levelPrimary: player.preferred_level_primary,
        levelSecondary: player.preferred_level_secondary,
      }))} />
    </div>
  );
}
