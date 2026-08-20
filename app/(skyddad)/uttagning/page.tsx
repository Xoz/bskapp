import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { getCoreActivities, getSelectionWorkspace } from "@/lib/developmentCore";
import { saveDevelopmentSelection } from "@/lib/coreActions";
import CoreActivityCard from "@/components/CoreActivityCard";
import SelectionEditor from "@/components/SelectionEditor";
import { sanktanLevelLabel } from "@/lib/sanktanLevel";

export const dynamic = "force-dynamic";

export default async function SelectionPage({
  searchParams,
}: {
  searchParams: Promise<{ aktivitet?: string; lag?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.primaryRole)) redirect("/mina-spelare");
  if (!user.permissions.includes("manage_squads")) redirect("/idag?behorighet=saknas");
  const { aktivitet, lag } = await searchParams;
  const selectedTeam = lag === "Gul" || lag === "Grön" ? lag : null;
  const listHref = selectedTeam ? `/uttagning?lag=${encodeURIComponent(selectedTeam)}` : "/uttagning";

  if (!aktivitet) {
    const matches = (await getCoreActivities(100, "sanktan")).filter((activity) => activity.is_upcoming);
    const visibleMatches = selectedTeam
      ? matches.filter((activity) => activity.source_team === selectedTeam)
      : matches;
    return (
      <div className="core-page">
        <header className="core-header">
          <div className="core-header-copy">
          <p className="core-kicker">Transparent beslutsstöd</p>
          <h1 className="core-title">Uttagning</h1>
          <p className="core-lead">
            Välj en kommande Sanktanmatch. Appen visar exponering, utvecklingsmöjligheter och belastning.
          </p>
          </div>
        </header>
        <nav className="core-team-filters" aria-label="Filtrera kommande Sanktanmatcher efter lag">
          <Link href="/uttagning" className={`core-team-filter ${selectedTeam === null ? "core-team-filter-active" : ""}`}>
            Alla <span>{matches.length}</span>
          </Link>
          {(["Gul", "Grön"] as const).map((team) => (
            <Link
              key={team}
              href={`/uttagning?lag=${encodeURIComponent(team)}`}
              className={`core-team-filter ${selectedTeam === team ? "core-team-filter-active" : ""}`}
              data-team-tone={team === "Gul" ? "yellow" : "green"}
            >
              {team} <span>{matches.filter((activity) => activity.source_team === team).length}</span>
            </Link>
          ))}
        </nav>
        <div className="core-list core-list-2">
          {visibleMatches.map((activity) => (
            <CoreActivityCard
              key={activity.id}
              activity={activity}
              href={`${listHref}${selectedTeam ? "&" : "?"}aktivitet=${encodeURIComponent(activity.id)}`}
            />
          ))}
        </div>
      </div>
    );
  }

  const workspace = await getSelectionWorkspace(aktivitet);
  if (!workspace) redirect("/uttagning");
  const saveAction = saveDevelopmentSelection.bind(null, workspace.activity.id);

  return (
    <div className="core-page">
      <header>
        <Link href={listHref} className="body-small" style={{ color: "var(--ink-secondary)" }}>← Alla kommande Sanktanmatcher</Link>
        <div className="core-header mt-2">
          <div>
            <p className="core-kicker">
              <span>{workspace.activity.activity_date}{workspace.activity.start_time ? ` · ${workspace.activity.start_time}` : ""}</span>
              {workspace.activity.competition_level && (
                <span className="selection-match-level" data-level={workspace.activity.competition_level}>
                  <strong>{sanktanLevelLabel(workspace.activity.competition_level)}</strong>
                  <small>Sanktan {workspace.activity.competition_level}</small>
                </span>
              )}
            </p>
            <h1 className="core-title">{workspace.activity.title}</h1>
            <p className="core-lead">
              Kallade spelare är markerade och deras svar visas direkt i listan.
            </p>
            {workspace.activity.source_team === "Gul" && (
              <p className="caption mt-2" style={{ color: "var(--ink-secondary)" }}>Gul prioriteras först, följt av F15 och därefter Grön som möjliga lån.</p>
            )}
            {workspace.activity.source_team === "Grön" && (
              <p className="caption mt-2" style={{ color: "var(--ink-secondary)" }}>Grön ansvarar för sin ordinarie trupp. Förslaget fördelar endast Gul-lån rättvist.</p>
            )}
          </div>
          <Link href={`/observera?aktivitet=${encodeURIComponent(workspace.activity.id)}`} className="btn-secondary">
            Observationer
          </Link>
        </div>
      </header>

      <SelectionEditor
        candidates={workspace.candidates}
        sourceTeam={workspace.activity.source_team}
        matchLevel={workspace.activity.competition_level}
        callupSummary={{
          accepted: Number(workspace.activity.accepted_callup_count),
          declined: Number(workspace.activity.declined_callup_count),
          pending: Number(workspace.activity.pending_callup_count),
        }}
        action={saveAction}
      />
    </div>
  );
}
