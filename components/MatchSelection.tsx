import Link from "next/link";
import {get} from "@/lib/db";
import {lineupKey,outboxKey,lineupRevision,type SourceLineup,type LineupJob} from "@/lib/svenskalag/outbox";
import {ORIGIN,TEAM_PATH} from "@/lib/svenskalag/model";
import { getSelectionWorkspace } from "@/lib/developmentCore";
import { saveDevelopmentSelection } from "@/lib/coreActions";
import SvenskaLagPublicationStatus from "@/components/SvenskaLagPublicationStatus";
import SelectionEditor from "@/components/SelectionEditor";
import { sanktanLevelLabel } from "@/lib/sanktanLevel";

type Workspace = NonNullable<Awaited<ReturnType<typeof getSelectionWorkspace>>>;
export default async function MatchSelection({ workspace }: { workspace: Workspace }) {
  const saveAction = saveDevelopmentSelection.bind(null, workspace.activity.id);

  const matchId=workspace.activity.match_id;
  const sourceRow=matchId==null?null:await get<{value:string}>("SELECT value FROM settings WHERE key=?",[lineupKey(matchId)]);
  const jobRow=matchId==null?null:await get<{value:string}>("SELECT value FROM settings WHERE key=?",[outboxKey(matchId)]);
  const source:SourceLineup|null=sourceRow?JSON.parse(sourceRow.value):null;
  const job:LineupJob|null=jobRow?JSON.parse(jobRow.value):null;
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
              Laguppställning: planerade spelare. Kallelser och svar visas för varje spelare; de som tackat ja utgör truppen.
            </p>
            <p className="caption mt-2" style={{ color: "var(--ink-secondary)" }}>Gul prioriteras först, följt av F15 och därefter Grön som möjliga lån.</p>
          </div>
        </div>
      </header>

      <section className="card p-4 space-y-2">
        <p>Svenska Lag styr match, kallelser och närvaro. Här förbereder du laguppställningen.</p>
        {job && <SvenskaLagPublicationStatus message={job.message} pending={job.state==="queued"||job.state==="running"}/> }
        {job && ["conflict","error"].includes(job.state) && <a className="underline" href={`/matcher/${matchId}/laguttagning`}>Läs in senaste läget innan du skickar igen</a>}
        {source ? <a className="underline" target="_blank" rel="noreferrer" href={`${ORIGIN}${TEAM_PATH}/match/${source.sourceId}`}>Öppna matchen i Svenska Lag och skicka kallelser →</a> : <p>Laguppställningen behöver hämtas från Svenska Lag innan du kan skicka den.</p>}
      </section>
      {workspace.candidates[0]?.matchSpace.sourceWarning && <p className="text-sm" style={{color:"var(--warning)"}}>{workspace.candidates[0].matchSpace.sourceWarning}</p>}
      <Link className="btn-secondary" href={`/matcher/${matchId}/matchutrymme`}>Jämför matchutrymme för kallelse och lån</Link>
      <p className="text-sm" style={{color: "var(--ink-secondary)"}}>Matchutrymme visar prognosen om spelaren deltar i denna match, även om hon ännu inte är kallad. Öppna poängen för att prova speltid. Reserven är 40 % av individuell kapacitet; under 60 % visas begränsat utrymme. Uppskattning: saknad speltid räknas som hela matchen, träning som 60 minuter. Andra idrotter och saknad närvaro ingår inte.</p>
      <SelectionEditor
        key={job?.finishedAt??"draft"}
        sourceRevision={source?lineupRevision(source.names):""}
        canPublish={Boolean(source)&&job?.state!=="running"&&job?.state!=="queued"}
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
