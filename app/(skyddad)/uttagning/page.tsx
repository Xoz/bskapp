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
  searchParams: Promise<{ aktivitet?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.primaryRole)) redirect("/mina-spelare");
  if (!user.permissions.includes("manage_squads")) redirect("/idag?behorighet=saknas");
  const { aktivitet } = await searchParams;

  if (!aktivitet) {
    const matches = (await getCoreActivities(100)).filter((activity) => activity.activity_type === "match");
    return (
      <div className="space-y-6">
        <header>
          <p className="eyebrow">Transparent beslutsstöd</p>
          <h1 className="mt-1">Uttagning</h1>
          <p className="body mt-2 max-w-2xl" style={{ color: "var(--ink-secondary)" }}>
            Appen visar exponering, utvecklingsmöjligheter och belastning. Tränaren väljer alltid laget.
          </p>
        </header>
        <div className="grid md:grid-cols-2 gap-3">
          {matches.map((activity) => (
            <CoreActivityCard
              key={activity.id}
              activity={activity}
              href={`/uttagning?aktivitet=${encodeURIComponent(activity.id)}`}
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
    <div className="space-y-7">
      <header>
        <Link href="/uttagning" className="caption">← Alla matchtillfällen</Link>
        <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="eyebrow">{workspace.activity.activity_date}{workspace.activity.start_time ? ` · ${workspace.activity.start_time}` : ""}</p>
            <h1 className="mt-1">{workspace.activity.title}</h1>
            <p className="body mt-2" style={{ color: "var(--ink-secondary)" }}>
              {selectedCount} uttagna · alfabetisk lista, ingen dold ranking
            </p>
          </div>
          <Link href={`/observera?aktivitet=${encodeURIComponent(workspace.activity.id)}`} className="btn-secondary">
            Observationer
          </Link>
        </div>
      </header>

      <section className="card p-5">
        <p className="eyebrow">Kontroller för helheten</p>
        <h2 className="mt-1">Truppbalans</h2>
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

      <form action={saveAction} className="space-y-3">
        <PilotStartField />
        {workspace.candidates.map((candidate) => (
          <article key={candidate.player.id} className="card p-4 md:p-5">
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
                  <label htmlFor={`selected-${candidate.player.id}`} className="font-semibold text-lg cursor-pointer">
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
                  <p key={reason} className="body-small rounded-lg px-3 py-2" style={{ background: "var(--ok-bg)" }}>Möjlighet: {reason}</p>
                ))}
                {candidate.support.cautions.map((reason) => (
                  <p key={reason} className="body-small rounded-lg px-3 py-2" style={{ background: "var(--warn-bg)" }}>Tänk på: {reason}</p>
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
