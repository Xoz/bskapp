import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { getPlayerCoreSummaries, type Evidence } from "@/lib/developmentCore";
import Avatar from "@/components/Avatar";

export const dynamic = "force-dynamic";

const EVIDENCE_LABELS: Record<Evidence, string> = { shown: "Visade", practicing: "Tränar på", revisit: "Nytt tillfälle" };
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
          Högst två aktiva mål per spelare. Observationer och exponering visar vad ni faktiskt har sett och erbjudit.
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
      <div className="core-list core-list-2">
        {visiblePlayers.map(({ player, teams, goals, lastObservation, trainingCount, matchCount, hasSanktanSync, sanktanGulCount, sanktanGronCount, callupCount }) => (
          <Link key={player.id} href={`/spelare/${player.id}`} className="core-player-card">
            <div className="flex items-start gap-4">
              <Avatar name={player.name} jersey={player.jersey_number} size={42} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h2 className="core-player-name truncate">{player.name}</h2>
                    {teams.length ? teams.map((team) => (
                      <span key={team.id} className="core-team-tag" data-team-tone={TEAM_TONES[team.name]}>{team.name}</span>
                    )) : (
                      <span className="core-team-tag core-team-tag-unassigned">Ej tilldelat lag</span>
                    )}
                  </div>
                  <span className={`core-tag ${goals.length ? "core-tag-training" : ""}`}>{goals.length}/2 mål</span>
                </div>
                <div>
                  {goals.length ? goals.map((goal) => (
                    <p key={goal.id} className="core-goal">{goal.title}</p>
                  )) : <p className="core-goal" style={{ borderColor: "var(--border)", color: "var(--ink-muted)" }}>Inget aktivt utvecklingsmål</p>}
                </div>
                <div className="core-statline">
                  <span>{trainingCount} träningar</span>
                  <span title={hasSanktanSync ? `Gul ${sanktanGulCount} · Grön ${sanktanGronCount}` : undefined}>
                    {matchCount} {hasSanktanSync ? "Sanktanmatcher" : "matcher"}
                  </span>
                  <span>{callupCount} kallelser</span>
                </div>
                {lastObservation && (
                  <p className="core-activity-sub mt-2">
                    Senast {lastObservation.activity_date}: {EVIDENCE_LABELS[lastObservation.evidence]} · {lastObservation.goal_title}
                  </p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
