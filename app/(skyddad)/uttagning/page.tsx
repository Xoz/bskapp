import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { getSelectionMatches, getSelectionWorkspace } from "@/lib/developmentCore";
import { saveDevelopmentSelection } from "@/lib/coreActions";
import CoreActivityCard from "@/components/CoreActivityCard";
import SelectionEditor from "@/components/SelectionEditor";
import { sanktanLevelLabel } from "@/lib/sanktanLevel";
import { swedishToday } from "@/lib/dates";

export const dynamic = "force-dynamic";

function endOfCurrentWeek(date: string) {
  const current = new Date(`${date}T12:00:00Z`);
  const daysUntilSunday = (7 - current.getUTCDay()) % 7;
  current.setUTCDate(current.getUTCDate() + daysUntilSunday);
  return current.toISOString().slice(0, 10);
}

export default async function SelectionPage({
  searchParams,
}: {
  searchParams: Promise<{ aktivitet?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.primaryRole)) redirect("/mina-spelare");
  if (!user.permissions.includes("manage_squads")) redirect("/idag?behorighet=saknas");
  const { aktivitet } = await searchParams;
  const listHref = "/uttagning";

  if (!aktivitet) {
    const matches = await getSelectionMatches();
    const weekEnd = endOfCurrentWeek(swedishToday());
    const thisWeek = matches.filter((activity) => activity.activity_date <= weekEnd);
    const later = matches.filter((activity) => activity.activity_date > weekEnd);
    return (
      <div className="core-page">
        <header className="core-header">
          <div className="core-header-copy">
          <p className="core-kicker">Transparent beslutsstöd</p>
          <h1 className="core-title">Uttagning</h1>
          <p className="core-lead">
            Gula lagets kommande Sanktanmatcher. Öppna en match för att se kallelser och svar eller skapa ett rättvist lagförslag.
          </p>
          </div>
        </header>
        {thisWeek.length > 0 && <section>
          <div className="core-section-head">
            <div><p className="core-section-eyebrow">Prioritera nu</p><h2 className="core-section-title">Den här veckan</h2></div>
            <span className="core-section-note">{thisWeek.length} {thisWeek.length === 1 ? "match" : "matcher"}</span>
          </div>
          <div className="core-list core-list-2">
            {thisWeek.map((activity) => (
              <CoreActivityCard
                key={activity.id}
                activity={activity}
                href={`${listHref}?aktivitet=${encodeURIComponent(activity.id)}`}
              />
            ))}
          </div>
        </section>}
        {later.length > 0 && <section>
          <div className="core-section-head">
            <div><p className="core-section-eyebrow">Planera framåt</p><h2 className="core-section-title">Senare matcher</h2></div>
            <span className="core-section-note">{later.length} matcher</span>
          </div>
          <div className="core-list core-list-2">
            {later.map((activity) => (
              <CoreActivityCard
                key={activity.id}
                activity={activity}
                href={`${listHref}?aktivitet=${encodeURIComponent(activity.id)}`}
              />
            ))}
          </div>
        </section>}
      </div>
    );
  }

  const workspace = await getSelectionWorkspace(aktivitet);
  if (!workspace || workspace.activity.source_team !== "Gul") redirect("/uttagning");
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
            <p className="caption mt-2" style={{ color: "var(--ink-secondary)" }}>Gul prioriteras först, följt av F15 och därefter Grön som möjliga lån.</p>
          </div>
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
