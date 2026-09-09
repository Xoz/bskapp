import Link from "next/link";
import { getSelectionWorkspace } from "@/lib/developmentCore";
import { saveDevelopmentSelection } from "@/lib/coreActions";
import SelectionEditor from "@/components/SelectionEditor";
import { sanktanLevelLabel } from "@/lib/sanktanLevel";

type Workspace = NonNullable<Awaited<ReturnType<typeof getSelectionWorkspace>>>;
export default function MatchSelection({ workspace }: { workspace: Workspace }) {
  const saveAction = saveDevelopmentSelection.bind(null, workspace.activity.id);

  return (
    <div className="core-page">
      <header>
        <Link href={workspace.activity.match_id != null ? `/matcher/${workspace.activity.match_id}` : "/matcher"} className="body-small" style={{ color: "var(--ink-secondary)" }}>← Tillbaka till matchen</Link>
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
