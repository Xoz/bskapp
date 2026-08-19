import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { getCoreActivities, getSelectionWorkspace } from "@/lib/developmentCore";
import { saveDevelopmentSelection } from "@/lib/coreActions";
import CoreActivityCard from "@/components/CoreActivityCard";
import PilotStartField from "@/components/PilotStartField";

export const dynamic = "force-dynamic";

const POSITIONS = ["", "Målvakt", "Försvar", "Mittfält", "Anfall"];

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
  const selectedCount = workspace.candidates.filter((candidate) => candidate.decision === "selected").length;

  return (
    <div className="core-page">
      <header>
        <Link href={listHref} className="body-small" style={{ color: "var(--ink-secondary)" }}>← Alla kommande Sanktanmatcher</Link>
        <div className="core-header mt-2">
          <div>
            <p className="core-kicker">{workspace.activity.activity_date}{workspace.activity.start_time ? ` · ${workspace.activity.start_time}` : ""}</p>
            <h1 className="core-title">{workspace.activity.title}</h1>
            <p className="core-lead">
              {selectedCount} uttagna · alfabetisk lista, ingen dold ranking
            </p>
          </div>
          <Link href={`/observera?aktivitet=${encodeURIComponent(workspace.activity.id)}`} className="btn-secondary">
            Observationer
          </Link>
        </div>
      </header>

      <section className="core-panel core-form-panel">
        <div className="core-section-head"><div><p className="core-kicker">Kontroller för helheten</p><h2 className="core-section-title mt-2">Truppbalans</h2></div></div>
        {workspace.warnings.length ? (
          <ul className="mt-3 space-y-2">
            {workspace.warnings.map((warning) => (
              <li key={warning} className="body-small rounded-xl p-3" style={{ background: "var(--warn-bg)", color: "var(--ink)" }}>
                {warning}
              </li>
            ))}
          </ul>
        ) : (
          <p className="body-small mt-2" style={{ color: "var(--ink-secondary)" }}>Inga balansvarningar för den sparade truppen.</p>
        )}
      </section>

      <form action={saveAction} className="core-list">
        <PilotStartField />
        {workspace.candidates.map((candidate) => (
          <article key={candidate.player.id} className="core-selection-card">
            <div className="grid lg:grid-cols-[minmax(210px,1fr)_minmax(260px,1.4fr)_260px] gap-4 items-start">
              <div>
                <div className="flex items-center gap-3">
                  <input
                    id={`selected-${candidate.player.id}`}
                    type="checkbox"
                    name="selected_player"
                    value={candidate.player.id}
                    defaultChecked={candidate.decision === "selected"}
                    className="h-5 w-5"
                  />
                  <label htmlFor={`selected-${candidate.player.id}`} className="core-player-name cursor-pointer">
                    {candidate.player.name}
                  </label>
                </div>
                <div className="flex gap-3 mt-2 caption" style={{ color: "var(--ink-secondary)" }}>
                  <span>{candidate.selectedLastEight}/8 senaste</span>
                  <span>{candidate.selectedCount} totalt sparade</span>
                </div>
                <label className="flex items-center gap-2 mt-3 caption">
                  <input type="checkbox" name="reserve_player" value={candidate.player.id} defaultChecked={candidate.decision === "reserve"} />
                  Reserv
                </label>
              </div>

              <div className="space-y-2">
                {candidate.support.opportunities.map((reason) => (
                  <p key={reason} className="core-signal" style={{ background: "var(--ok-bg)" }}>Möjlighet: {reason}</p>
                ))}
                {candidate.support.cautions.map((reason) => (
                  <p key={reason} className="core-signal" style={{ background: "var(--warn-bg)" }}>Tänk på: {reason}</p>
                ))}
                {candidate.goals.map((goal) => (
                  <p key={goal.id} className="caption" style={{ color: "var(--ink-secondary)" }}>Mål: {goal.title}</p>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label>
                  <span className="caption">Perioder</span>
                  <input name={`periods_${candidate.player.id}`} type="number" min={0} max={9} className="input mt-1" defaultValue={candidate.periodsPlayed || 0} />
                </label>
                <label>
                  <span className="caption">Position</span>
                  <select name={`position_${candidate.player.id}`} className="input mt-1" defaultValue={candidate.player.position || ""}>
                    {POSITIONS.map((position) => <option key={position || "none"} value={position}>{position || "Ej satt"}</option>)}
                  </select>
                </label>
                <input
                  name={`rationale_${candidate.player.id}`}
                  className="input col-span-2"
                  placeholder="Kort beslutsskäl, frivilligt"
                  maxLength={240}
                />
              </div>
            </div>
          </article>
        ))}
        <div className="sticky bottom-20 md:bottom-4 flex justify-end">
          <button type="submit" className="btn-primary shadow-lg">Spara tränarens beslut</button>
        </div>
      </form>
    </div>
  );
}
