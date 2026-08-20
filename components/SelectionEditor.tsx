"use client";

import { useMemo, useState } from "react";
import PilotStartField from "@/components/PilotStartField";
import { recommendYellowSelection, squadBalanceWarnings, type SelectionRecommendation } from "@/lib/selectionSupport";

const POSITIONS = ["", "Målvakt", "Back", "Mittfält", "Vänsterkant", "Högerkant", "Anfall"];
const SELECTION_GRID = "2rem minmax(12rem, 1fr) 6.5rem 6.75rem 6.75rem 5rem 5.5rem 6.5rem 8.25rem";

type Candidate = {
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
  decision: "selected" | "reserve" | "rested";
  teams: { id: number; name: string; isPrimary: boolean }[];
  primaryTeam: { id: number; name: string } | null;
  selectedLastEight: number;
  selectedLastThree: number;
  matchCount: number;
  callupCount: number;
  plannedUpcomingCount: number;
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
}: {
  candidates: Candidate[];
  sourceTeam: string | null;
  matchLevel: number | null;
  callupSummary: { accepted: number; declined: number; pending: number };
  action: (formData: FormData) => Promise<void>;
}) {
  const [selectedIds, setSelectedIds] = useState(() => new Set(candidates.filter((candidate) => candidate.decision === "selected").map((candidate) => candidate.player.id)));
  const [positions, setPositions] = useState(() => Object.fromEntries(candidates.map((candidate) => [candidate.player.id, candidate.player.preferred_position_primary || candidate.player.position || ""])) as Record<number, string>);
  const [teamFilter, setTeamFilter] = useState<string>("Alla");
  const [recommendationReasons, setRecommendationReasons] = useState<Record<number, string>>({});
  const [recommendationSummary, setRecommendationSummary] = useState<SelectionRecommendation | null>(null);
  const [selectionBeforeRecommendation, setSelectionBeforeRecommendation] = useState<Set<number> | null>(null);

  const selected = useMemo(
    () => candidates.filter((candidate) => selectedIds.has(candidate.player.id)),
    [candidates, selectedIds]
  );
  const warnings = useMemo(
    () => squadBalanceWarnings(selected.map((candidate) => ({
      position: positions[candidate.player.id] ?? "",
      selectedLastThree: candidate.selectedLastThree,
    }))),
    [positions, selected]
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
  const visibleCandidates = useMemo(
    () => teamFilter === "Alla"
      ? candidates
      : candidates.filter((candidate) => candidate.teams.some((team) => team.name === teamFilter)),
    [candidates, teamFilter]
  );
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
  }

  function applyRecommendation() {
    const recommendation = recommendYellowSelection({
      matchLevel,
      sourceTeam,
      targetSize: Math.max(9, selectedIds.size),
      candidates: candidates.map((candidate) => ({
        id: candidate.player.id,
        name: candidate.player.name,
        teamNames: candidate.teams.map((team) => team.name),
        primaryTeamName: candidate.primaryTeam?.name ?? null,
        callupCount: candidate.callupCount,
        plannedUpcomingCount: candidate.plannedUpcomingCount,
        lastSelectedDate: candidate.lastSelectedDate,
        primaryLevel: candidate.player.preferred_level_primary,
        secondaryLevel: candidate.player.preferred_level_secondary,
        primaryPosition: candidate.player.preferred_position_primary || candidate.player.position || "",
        secondaryPosition: candidate.player.preferred_position_secondary,
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
          <div className="selection-summary-kicker"><span className="selection-summary-dot" /> Truppen just nu</div>
          <div className="selection-summary-count"><strong>{selected.length}</strong><span>markerade</span></div>
          <p className="selection-summary-copy">
            {calledCount > 0
              ? `Urvalet speglar den synkade kallelsen.${unlinkedCalledCount > 0 ? ` ${unlinkedCalledCount} kallad saknar aktiv spelarprofil.` : ""}`
              : "Ingen synkad kallelse finns ännu. Markera spelare manuellt i listan."}
          </p>
        </div>
        <div className="selection-summary-stat">
          <span>Kallelse</span>
          <strong>{calledCount}</strong>
          <small>{callupSummary.accepted} ja · {callupSummary.declined} nej · {callupSummary.pending} inväntar</small>
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

      <form action={action} className="selection-workspace">
        <PilotStartField />
        <div className="selection-toolbar">
          <div>
            <p className="selection-toolbar-title">Matchtrupp</p>
            <p className="selection-toolbar-subtitle">Välj spelare och ange position vid behov</p>
          </div>
          <div className="selection-toolbar-tools">
            {(sourceTeam === "Gul" || sourceTeam === "Grön") && (
              <button type="button" className="selection-recommend-button" onClick={applyRecommendation}>
                <span className="selection-recommend-icon" aria-hidden="true">↻</span>
                {recommendationSummary
                  ? "Räkna om förslag"
                  : sourceTeam === "Grön" ? "Föreslå rättvisa Gul-lån" : "Föreslå rättvis trupp"}
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
              <span>Pos 2</span>
              <span className="selection-number">Matcher</span>
              <span className="selection-number">Kallelser</span>
              <span>Svar</span>
              <span>Vald position</span>
            </div>
            <ul className="selection-table-body">
              {visibleCandidates.map((candidate) => {
            const selectedForMatch = selectedIds.has(candidate.player.id);
            const recommendationReason = recommendationReasons[candidate.player.id];
            const teamNames = candidate.teams.length > 0 ? candidate.teams.map((team) => team.name).join(", ") : "Ingen lagkoppling";
            return (
              <li key={candidate.player.id} className={`selection-row ${selectedForMatch ? "selection-row-selected" : ""}`}>
                <div className="selection-row-grid" style={{ gridTemplateColumns: SELECTION_GRID }}>
                  <input
                    id={`selected-${candidate.player.id}`}
                    type="checkbox"
                    name="selected_player"
                    value={candidate.player.id}
                    checked={selectedForMatch}
                    onChange={(event) => toggleSelected(candidate.player.id, event.target.checked)}
                    className="selection-checkbox"
                  />
                  <label htmlFor={`selected-${candidate.player.id}`} className="selection-player">
                    <span className="selection-player-copy">
                      <span className="selection-player-name">{candidate.player.name}</span>
                      {recommendationReason && <small className="selection-player-reason">{recommendationReason}</small>}
                    </span>
                    {recommendationReason
                      ? <span className="selection-player-status">Förslag</span>
                      : candidate.currentCallupStatus
                        ? <span className="selection-player-status selection-player-status-manual">Kallad</span>
                        : selectedForMatch && <span className="selection-player-status selection-player-status-manual">Vald</span>}
                  </label>
                  <span className="selection-teams" title={teamNames}>
                    {candidate.teams.length > 0 ? candidate.teams.map((team) => <span key={team.id} className="selection-team-tag" data-team-tone={teamTone(team.name)}>{team.name}</span>) : <span className="selection-empty">—</span>}
                  </span>
                  <span className="selection-preference" title={`Val 1: ${candidate.player.preferred_position_primary || "Ej satt"}`}>
                    {candidate.player.preferred_position_primary || "—"}
                  </span>
                  <span className="selection-preference" title={`Val 2: ${candidate.player.preferred_position_secondary || "Ej satt"}`}>
                    {candidate.player.preferred_position_secondary || "—"}
                  </span>
                  <span className="selection-number tabular-nums">
                    {candidate.matchCount}
                  </span>
                  <span className="selection-number tabular-nums">
                    {candidate.callupCount}
                  </span>
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
                        name={`position_${candidate.player.id}`}
                        className="selection-position-input"
                        value={positions[candidate.player.id] ?? ""}
                        onChange={(event) => setPositions((current) => ({ ...current, [candidate.player.id]: event.target.value }))}
                      >
                        {POSITIONS.map((position) => <option key={position || "none"} value={position}>{position || "Ej satt"}</option>)}
                      </select>
                    </label>
                  )}
                </div>
              </li>
            );
              })}
            </ul>
          </div>
        </div>
        <div className="selection-footer">
          <span>{selected.length} spelare valda</span>
          <button type="submit" className="btn-primary selection-save-button">Spara uttagning <span aria-hidden="true">→</span></button>
        </div>
      </form>
    </>
  );
}
