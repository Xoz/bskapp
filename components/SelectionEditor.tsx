"use client";

import { useMemo, useState } from "react";
import PilotStartField from "@/components/PilotStartField";
import { batteryPercent, forecastMatchSpace, spaceLabels, type SpaceInput } from "@/lib/matchSpace";
import { selectionPositionRank } from "@/lib/positions";
import { recommendYellowSelection, squadBalanceWarnings, type SelectionRecommendation } from "@/lib/selectionSupport";

import {assessSelection,selectionSpace,type Evidence} from "@/lib/selection/rules";

const POSITIONS = ["", "Målvakt", "Back", "Mittfält", "Vänsterkant", "Högerkant", "Anfall"];
const SELECTION_GRID = "2rem minmax(12rem, 1fr) 6.5rem 7.5rem 6rem 6.5rem 8.25rem";

type Candidate = {
  selectionEvidence?: Evidence;
  matchSpace?: SpaceInput;
  player: {
    id: number;
    name: string;
    position: string | null;
    preferred_position_primary: string;
    preferred_position_secondary: string;
    preferred_level_primary: string;
    preferred_level_secondary: string;
    selection_eligible: number;
  };
  selected: boolean;
  teams: { id: number; name: string; isPrimary: boolean }[];
  primaryTeam: { id: number; name: string } | null;
  selectedLastEight: number;
  selectedLastThree: number;
  matchCount: number;
  callupCount: number;
  plannedUpcomingCount: number;
  windowMatchCount: number;
  recentMatchCount: number;
  upcomingMatchCount: number;
  lastSelectedDate: string | null;
  currentCallupStatus: "accepted" | "declined" | "pending" | null;
  goals: { id: string; title: string }[];
  support: { opportunities: string[]; cautions: string[] };
};

export default function SelectionEditor({
  candidates,
  sourceTeam,
  matchLevel,
  callupSummary,
  action,
  canPublish = false,
  sourceRevision = "",
}: {
  candidates: Candidate[];
  sourceTeam: string | null;
  matchLevel: number | null;
  callupSummary: { accepted: number; declined: number; pending: number };
  action: (formData: FormData) => Promise<void>;
  canPublish?: boolean;
  sourceRevision?: string;
}) {
  const [saveError,setSaveError]=useState("");
  const [saving,setSaving]=useState(false);
  const [reviewAck,setReviewAck]=useState(false);
  const [scenarioMinutes, setScenarioMinutes] = useState<Record<number, number>>({});

  const [openedSourceRevision]=useState(sourceRevision);
  const [selectedIds, setSelectedIds] = useState(() => new Set(candidates.filter((candidate) => candidate.selected).map((candidate) => candidate.player.id)));
  const [positions, setPositions] = useState(() => Object.fromEntries(candidates.map((candidate) => [candidate.player.id, candidate.player.preferred_position_primary || candidate.player.position || ""])) as Record<number, string>);
  const simulations = useMemo(()=>new Map(candidates.map(c=>{
    const count=Math.max(callupSummary.accepted,candidates.filter(p=>selectedIds.has(p.player.id)&&p.currentCallupStatus!=="declined").length+(selectedIds.has(c.player.id)?0:1),1);
    const space=c.matchSpace?selectionSpace(c.matchSpace,c.player.id,positions[c.player.id]??"",count,scenarioMinutes[c.player.id]):null;
    return [c.player.id,space];
  })),[candidates,selectedIds,positions,scenarioMinutes,callupSummary.accepted]);
  const forecasts=useMemo(()=>new Map(candidates.map(c=>[c.player.id,simulations.get(c.player.id)?forecastMatchSpace(simulations.get(c.player.id)!):null])),[candidates,simulations]);
  const assessments=useMemo(()=>new Map(candidates.map(c=>[c.player.id,c.selectionEvidence&&simulations.get(c.player.id)?assessSelection(c.selectionEvidence,simulations.get(c.player.id)!):null])),[candidates,simulations]);
  const [teamFilter, setTeamFilter] = useState<string>(() => candidates.some(c => c.teams.some(t => t.name === "Gul")) ? "Gul" : "Alla");
  const [recommendationReasons, setRecommendationReasons] = useState<Record<number, string>>({});
  const [recommendationSummary, setRecommendationSummary] = useState<SelectionRecommendation | null>(null);
  const [selectionBeforeRecommendation, setSelectionBeforeRecommendation] = useState<Set<number> | null>(null);

  const selected = useMemo(
    () => candidates.filter((candidate) => selectedIds.has(candidate.player.id)),
    [candidates, selectedIds]
  );
  const warnings = useMemo(
    () => [...squadBalanceWarnings(selected.map((candidate) => ({
      spaceLevel: forecasts.get(candidate.player.id)?.level,
      recentMatchCount: candidate.recentMatchCount,
      upcomingMatchCount: candidate.upcomingMatchCount,
    }))), ...(selected.length > 0 && !selected.some(c => /^(målvakt|malvakt|gk)$/i.test(positions[c.player.id] ?? "")) ? ["Målvakt saknas i uttagningen"] : []), ...selected.flatMap(c=>(assessments.get(c.player.id)?.blocks??[]).map(reason=>`${c.player.name}: ${reason}`))],
    [selected, forecasts, assessments, positions]
  );
  const teamOptions = useMemo(() => {
    const unique = new Set<string>();
    candidates.forEach((candidate) => {
      candidate.teams.forEach((team) => unique.add(team.name));
    });
    const preferredOrder = ["Gul", "Grön", "F15"];
    const ordered = preferredOrder.filter((name) => unique.has(name));
    unique.forEach((name) => {
      if (!ordered.includes(name)) ordered.push(name);
    });
    return ["Alla", ...ordered];
  }, [candidates]);
  const visibleCandidates = useMemo(() => {
    const filtered = teamFilter === "Alla"
      ? candidates
      : candidates.filter((candidate) => candidate.teams.some((team) => team.name === teamFilter));
    return [...filtered].sort((left, right) =>
      Number(selectedIds.has(right.player.id) || right.currentCallupStatus !== null)
      - Number(selectedIds.has(left.player.id) || left.currentCallupStatus !== null)
      || selectionPositionRank(left.player.preferred_position_primary, left.player.position)
      - selectionPositionRank(right.player.preferred_position_primary, right.player.position)
      || left.player.name.localeCompare(right.player.name, "sv")
    );
  }, [candidates, teamFilter, selectedIds]);
  const calledCount = callupSummary.accepted + callupSummary.declined + callupSummary.pending;
  const linkedCalledCount = candidates.filter((candidate) => candidate.currentCallupStatus !== null).length;
  const unlinkedCalledCount = Math.max(0, calledCount - linkedCalledCount);

  function teamTone(teamName: string) {
    if (teamName === "Gul") return "yellow";
    if (teamName === "Grön") return "green";
    if (teamName === "F15") return "blue";
    return "neutral";
  }

  function toggleSelected(playerId: number, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(playerId);
      else next.delete(playerId);
      return next;
    });
    setRecommendationReasons((current) => {
      if (!(playerId in current)) return current;
      const next = { ...current };
      delete next[playerId];
      return next;
    });
    setRecommendationSummary(null);
    setReviewAck(false);
  }

  function applyRecommendation() {
    const recommendation = recommendYellowSelection({
      matchLevel,
      sourceTeam,
      targetSize: 9,
      candidates: candidates.map((candidate) => ({
        selectionEvidence: candidate.selectionEvidence,
        matchSpace: candidate.matchSpace,
        position: positions[candidate.player.id],
        id: candidate.player.id,
        name: candidate.player.name,
        teamNames: candidate.teams.map((team) => team.name),
        primaryTeamName: candidate.primaryTeam?.name ?? null,
        windowMatchCount: candidate.windowMatchCount,
        spaceLevel: candidate.matchSpace ? forecastMatchSpace(selectionSpace(candidate.matchSpace,candidate.player.id,positions[candidate.player.id]??"",9)).level : undefined,
      recentMatchCount: candidate.recentMatchCount,
        upcomingMatchCount: candidate.upcomingMatchCount,
        lastSelectedDate: candidate.lastSelectedDate,
        primaryLevel: candidate.player.preferred_level_primary,
        secondaryLevel: candidate.player.preferred_level_secondary,
        selectionEligible: Boolean(candidate.player.selection_eligible),
        currentlySelected: selectedIds.has(candidate.player.id),
        currentCallupStatus: candidate.currentCallupStatus,
      })),
    });
    setSelectionBeforeRecommendation(new Set(selectedIds));
    setSelectedIds(new Set(recommendation.selectedIds));
    setRecommendationReasons(recommendation.reasons);
    setRecommendationSummary(recommendation);
  }

  function undoRecommendation() {
    if (selectionBeforeRecommendation) setSelectedIds(new Set(selectionBeforeRecommendation));
    setSelectionBeforeRecommendation(null);
    setRecommendationReasons({});
    setRecommendationSummary(null);
  }

  return (
    <>
      <section className="selection-summary">
        <div className="selection-summary-main">
          <div className="selection-summary-kicker"><span className="selection-summary-dot" /> Trupp · ja-svar i Svenska Lag</div>
          <div className="selection-summary-count"><strong>{calledCount > 0 ? callupSummary.accepted : "—"}</strong><span>har tackat ja</span></div>
          <p className="selection-summary-copy">
            {calledCount > 0
              ? `${calledCount} kallade · ${callupSummary.declined} nej · ${callupSummary.pending} inväntar svar. Du bestämmer laguppställningen.${unlinkedCalledCount > 0 ? ` ${unlinkedCalledCount} kallad saknar aktiv spelarprofil.` : ""}`
              : "Ingen synkad kallelse finns ännu. Markera spelare manuellt i listan."}
          </p>
        </div>
        <div className="selection-summary-stat">
          <span>Laguppställning</span>
          <strong>{selected.length}</strong>
          <small>uttagna · planerade att spela</small>
        </div>
        <div className="selection-summary-stat selection-summary-stat-accent">
          <span>Balans</span>
          <strong>{warnings.length === 0 ? "OK" : warnings.length}</strong>
          <small>{warnings.length === 0 ? "inga varningar" : "att se över"}</small>
        </div>
        {warnings.length > 0 && (
          <ul className="selection-summary-warnings">
            {warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        )}
      </section>

      <details className="text-sm"><summary className="cursor-pointer">Regler för uttagningsförslag</summary><p className="mt-2">Förslaget gäller nio spelare. Högst två matcher samma dag med godkänd nivåkombination och minst 50 % batteri. Under 50 % kräver ditt aktiva val. Tidsmarginal: 15 min på samma plats, annars 60 min; restiden är ett antagande. Befintliga val och ja-svar bevaras.</p></details>
      <form action={async form=>{setSaving(true);setSaveError("");try{await action(form);}catch(error){setSaveError(error instanceof Error?error.message:"Kunde inte spara uttagningen.");}finally{setSaving(false);}}} className="selection-workspace">
        <PilotStartField />
        <input type="hidden" name="source_revision" value={openedSourceRevision}/>
        {selected.map(c=><span key={c.player.id}><input type="hidden" name="selected_player" value={c.player.id}/><input type="hidden" name={`position_${c.player.id}`} value={positions[c.player.id]??""}/></span>)}
        <div className="selection-toolbar">
          <div>
            <p className="selection-toolbar-title">Laguppställning</p>
            <p className="selection-toolbar-subtitle">Uttagen betyder planerad att spela. Kallelse är skickad eller kommer att skickas. Truppen består av dem som tackat ja.</p>
          </div>
          <div className="selection-toolbar-tools">
            {(sourceTeam === "Gul" || sourceTeam === "Grön") && (
              <button type="button" className="selection-recommend-button" onClick={applyRecommendation}>
                <span className="selection-recommend-icon" aria-hidden="true">↻</span>
                {recommendationSummary
                  ? "Räkna om förslag"
                  : sourceTeam === "Grön" ? "Föreslå Gul-lån för tomma platser" : "Föreslå spelare för tomma platser"}
              </button>
            )}
            <div className="selection-filter-group" role="group" aria-label="Filtrera spelare efter lag">
              <span className="selection-filter-label">Lag</span>
              <div className="core-team-filters selection-filter-pills">
                {teamOptions.map((team) => (
                  <button
                    key={team}
                    type="button"
                    className={`core-team-filter ${teamFilter === team ? "core-team-filter-active" : ""}`}
                    data-team-tone={team === "Gul" ? "yellow" : team === "Grön" ? "green" : team === "F15" ? "blue" : undefined}
                    onClick={() => setTeamFilter(team)}
                  >
                    {team} <span>{team === "Alla" ? candidates.length : candidates.filter((candidate) => candidate.teams.some((candidateTeam) => candidateTeam.name === team)).length}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        {recommendationSummary && (
          <div className="selection-recommendation-notice" aria-live="polite">
            <span className="selection-recommendation-mark" aria-hidden="true">✓</span>
            <p>
              <strong>Förslag klart</strong>
              <span>{recommendationSummary.selectedIds.length} spelare · {recommendationSummary.yellowCount} Gul · {recommendationSummary.fillerCount} utfyllnad</span>
              {recommendationSummary.warnings?.map(w=><span key={w}>{w}</span>)}
            </p>
            <button type="button" onClick={undoRecommendation}>Ångra</button>
          </div>
        )}
        <div className="selection-table-scroll">
          <div className="selection-table">
            <div className="selection-table-head" style={{ gridTemplateColumns: SELECTION_GRID }}>
              <span />
              <span>Spelare</span>
              <span>Lag</span>
              <span>Pos 1</span>
              <span className="selection-number">Matchutrymme</span>
              <span>Svar</span>
              <span>Vald position</span>
            </div>
            <ul className="selection-table-body">
              {visibleCandidates.map((candidate) => {
                const selectedForMatch = selectedIds.has(candidate.player.id);
                const recommendationReason = recommendationReasons[candidate.player.id];
                const teamNames = candidate.teams.length > 0 ? candidate.teams.map((team) => team.name).join(", ") : "Ingen lagkoppling";
                const forecast = forecasts.get(candidate.player.id);
                const assessment = assessments.get(candidate.player.id);
                return (
              <li
                key={candidate.player.id}
                className={`selection-row ${selectedForMatch ? "selection-row-selected" : ""} ${candidate.currentCallupStatus ? "selection-row-called" : ""}`}
                data-callup-status={candidate.currentCallupStatus ?? undefined}
              >
                <div className="selection-row-grid" style={{ gridTemplateColumns: SELECTION_GRID }}>
                  <input
                    id={`selected-${candidate.player.id}`}
                    type="checkbox"
                    value={candidate.player.id}
                    checked={selectedForMatch}
                    onChange={(event) => toggleSelected(candidate.player.id, event.target.checked)}
                    className="selection-checkbox"
                  />
                  <label htmlFor={`selected-${candidate.player.id}`} className="selection-player">
                    <span className="selection-player-copy">
                      <span className="selection-player-name">{candidate.player.name}</span>
                      {recommendationReason && <small className="selection-player-reason">{recommendationReason}</small>}
                      {assessment && <span className="block text-xs mt-1">{assessment.training.label}<br/>{assessment.history.offered} erbjudna · {assessment.history.played} spelade · {assessment.history.declined} nej (4 veckor)</span>}
                    </span>
                    <span className="flex flex-wrap gap-1">
                      {selectedForMatch && <span className="selection-player-status selection-player-status-manual">Uttagen</span>}
                      {candidate.currentCallupStatus && <span className="selection-player-status selection-player-status-manual">Kallad</span>}
                      {recommendationReason && <span className="selection-player-status">Förslag</span>}
                    </span>
                  </label>
                  <span className="selection-teams" title={teamNames}>
                    {candidate.teams.length > 0 ? candidate.teams.map((team) => <span key={team.id} className="selection-team-tag" data-team-tone={teamTone(team.name)}>{team.name}</span>) : <span className="selection-empty">—</span>}
                  </span>
                  <span className="selection-preference" title={`Val 1: ${candidate.player.preferred_position_primary || "Ej satt"}`}>
                    {candidate.player.preferred_position_primary || "—"}
                  </span>
                  <div className="text-sm" style={{ color: forecast?.level === "high" ? "var(--danger)" : forecast?.level === "maximum" ? "var(--warning)" : "var(--ink-secondary)" }}>
                    {forecast ? <details>
                      <summary className="cursor-pointer"><strong>{batteryPercent(forecast.after, forecast.capacity)}%</strong><br />{spaceLabels[forecast.level]}</summary>
                      <p className="mt-2">Inför: {batteryPercent(forecast.before, forecast.capacity)} % · Efter: {batteryPercent(forecast.after, forecast.capacity)} % · Lägst därefter: {batteryPercent(forecast.lowest, forecast.capacity)} %</p>
                      {forecast.conflict && <p>Krockar med annan aktivitet.</p>}
                      {forecast.nextAffected && <p>Låg marginal vid {forecast.nextAffected}.</p>}
                      <label className="block mt-2">Prova speltid (min)
                        <input aria-label={`Prova speltid för ${candidate.player.name}`} type="number" min={0} step="any" max={candidate.matchSpace?.target?.duration ?? 60} value={scenarioMinutes[candidate.player.id] ?? Math.round((candidate.matchSpace?.target?.minutes ?? 60) * 10) / 10} className="input w-full" onChange={event => setScenarioMinutes(current => ({ ...current, [candidate.player.id]: Math.max(0, Math.min(candidate.matchSpace?.target?.duration ?? 60, Number(event.target.value))) }))} />
                      </label>
                      <p>Uppskattning. Speltiden är endast en simulering.</p>
                    </details> : "Underlag saknas"}
                  </div>
                  {candidate.currentCallupStatus ? (
                    <span className="selection-callup-status" data-callup-status={candidate.currentCallupStatus}>
                      {candidate.currentCallupStatus === "accepted"
                        ? "Ja"
                        : candidate.currentCallupStatus === "declined" ? "Nej" : "Inväntar"}
                    </span>
                  ) : <span className="selection-empty">—</span>}
                  {selectedForMatch && (
                    <label className="selection-position-select">
                      <span className="sr-only">Position</span>
                      <select
                        className="selection-position-input"
                        value={positions[candidate.player.id] ?? ""}
                        onChange={(event) => setPositions((current) => ({ ...current, [candidate.player.id]: event.target.value }))}
                      >
                        {POSITIONS.map((position) => <option key={position || "none"} value={position}>{position || "Ej satt"}</option>)}
                      </select>
                    </label>
                  )}
                </div>
                {assessment && <details className="px-4 pb-3 text-sm">
                  <summary className="cursor-pointer">{assessment.blocks.length?'Kräver tränarbedömning':'Visa uttagningsunderlag'}</summary>
                  <ul className="mt-2 space-y-1">{[...assessment.blocks,...assessment.reasons,...assessment.cautions].map((text,i)=><li key={i}>{text}</li>)}</ul>
                  <p className="mt-2">Ordinarie träningar före uttagningen. Extraträning påverkar endast batteriet. Nej-svar ger ingen automatisk rätt till kompensationsmatcher.</p>
                  <a className="underline" href={`/spelare/${candidate.player.id}#uttagningsregler`}>Ändra nivåkombinationer eller undanta giltig frånvaro</a>
                </details>}
              </li>
                );
              })}
            </ul>
          </div>
        </div>
        <p role="alert" className="text-sm">{saveError}</p>
        {selected.some(c=>(assessments.get(c.player.id)?.blocks.length??0)>0) && <label className="flex gap-2 items-start text-sm p-3"><input name="selection_review_ack" value="1" type="checkbox" checked={reviewAck} onChange={e=>setReviewAck(e.target.checked)}/>Jag har granskat varningarna och väljer dessa spelare aktivt. Fler än två matcher samma dag kan inte läggas till.</label>}
        <div className="selection-footer">
          <span>{selected.length} spelare valda</span>
          <button type="submit" name="intent" value="save" disabled={saving} className="btn-secondary selection-save-button">Spara utkast</button>
          {canPublish && <button type="submit" name="intent" value="publish" disabled={saving||selected.length===0} className="btn-primary selection-save-button">Skicka till Svenska Lag →</button>}
        </div>
      </form>
    </>
  );
}
