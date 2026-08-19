"use client";

import { useMemo, useState } from "react";
import PilotStartField from "@/components/PilotStartField";
import { squadBalanceWarnings } from "@/lib/selectionSupport";

const POSITIONS = ["", "Målvakt", "Back", "Mittfält", "Vänsterkant", "Högerkant", "Anfall"];
const SELECTION_GRID = "2rem minmax(13rem, 1fr) 7rem 7.25rem 7.25rem 5.25rem 5.75rem 8.75rem";

type Candidate = {
  player: {
    id: number;
    name: string;
    position: string | null;
    preferred_position_primary: string;
    preferred_position_secondary: string;
  };
  decision: "selected" | "reserve" | "rested";
  teams: { id: number; name: string }[];
  selectedLastEight: number;
  selectedLastThree: number;
  matchCount: number;
  callupCount: number;
  goals: { id: string; title: string }[];
  support: { opportunities: string[]; cautions: string[] };
};

export default function SelectionEditor({
  candidates,
  action,
}: {
  candidates: Candidate[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [selectedIds, setSelectedIds] = useState(() => new Set(candidates.filter((candidate) => candidate.decision === "selected").map((candidate) => candidate.player.id)));
  const [positions, setPositions] = useState(() => Object.fromEntries(candidates.map((candidate) => [candidate.player.id, candidate.player.preferred_position_primary || candidate.player.position || ""])) as Record<number, string>);
  const [teamFilter, setTeamFilter] = useState<string>("Alla");

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
  }

  return (
    <>
      <section className="selection-summary">
        <div className="selection-summary-main">
          <div className="selection-summary-kicker"><span className="selection-summary-dot" /> Truppen just nu</div>
          <div className="selection-summary-count"><strong>{selected.length}</strong><span>uttagna</span></div>
          <p className="selection-summary-copy">
            {selected.length > 0
              ? "Spelare valda till matchtruppen. Ändra urvalet direkt i listan nedan."
              : "Markera spelare i listan för att bygga matchtruppen."}
          </p>
        </div>
        <div className="selection-summary-stat">
          <span>Spelarlista</span>
          <strong>{visibleCandidates.length}</strong>
          <small>{teamFilter === "Alla" ? "alla lag" : teamFilter}</small>
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
              <span>Vald position</span>
            </div>
            <ul className="selection-table-body">
              {visibleCandidates.map((candidate) => {
            const selectedForMatch = selectedIds.has(candidate.player.id);
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
                    <span className="selection-player-name">{candidate.player.name}</span>
                    {selectedForMatch && <span className="selection-player-status">Vald</span>}
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
