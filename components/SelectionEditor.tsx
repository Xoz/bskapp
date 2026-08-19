"use client";

import { useMemo, useState } from "react";
import PilotStartField from "@/components/PilotStartField";
import { squadBalanceWarnings } from "@/lib/selectionSupport";

const POSITIONS = ["", "Målvakt", "Back", "Mittfält", "Vänsterkant", "Högerkant", "Anfall"];

type Candidate = {
  player: { id: number; name: string; position: string | null; preferred_position_primary: string };
  decision: "selected" | "reserve" | "rested";
  selectedLastEight: number;
  selectedLastThree: number;
  matchCount: number;
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
      <section className="core-panel core-form-panel">
        <div className="core-section-head">
          <div><p className="core-kicker">Truppen just nu</p><h2 className="core-section-title mt-2">{selected.length} uttagna</h2></div>
          <span className="core-section-note">Uppdateras direkt</span>
        </div>
        {selected.length > 0 ? (
          <div className="core-player-chips mt-4">
            {selected.map((candidate) => <span key={candidate.player.id} className="badge">{candidate.player.name}</span>)}
          </div>
        ) : (
          <p className="body-small mt-3" style={{ color: "var(--ink-secondary)" }}>Markera en spelare för att lägga till henne i truppen.</p>
        )}
        <ul className="mt-4 space-y-2">
          {warnings.map((warning) => (
            <li key={warning} className="body-small rounded-xl p-3" style={{ background: "var(--warn-bg)", color: "var(--ink)" }}>{warning}</li>
          ))}
        </ul>
      </section>

      <form action={action} className="core-list">
        <PilotStartField />
        {candidates.map((candidate) => {
          const selectedForMatch = selectedIds.has(candidate.player.id);
          const opportunities = candidate.support.opportunities;
          const cautions = candidate.support.cautions;
          const goals = candidate.goals;
          const opportunitiesText = opportunities.length === 0
            ? "Inga särskilda möjligheter noterade"
            : `${opportunities.slice(0, 2).join(" · ")}${opportunities.length > 2 ? ` +${opportunities.length - 2}` : ""}`;
          const cautionsText = cautions.length === 0
            ? "Inga särskilda varningar"
            : `${cautions.slice(0, 2).join(" · ")}${cautions.length > 2 ? ` +${cautions.length - 2}` : ""}`;
          const goalsText = goals.length === 0
            ? "Inget aktivt mål i fokus"
            : `${goals[0].title}${goals.length > 1 ? ` +${goals.length - 1}` : ""}`;

          return (
            <article key={candidate.player.id} className={`core-selection-card${selectedForMatch ? " core-selection-card-selected" : ""}`}>
              <div className="flex flex-wrap items-center gap-2.5 py-2">
                <input
                  id={`selected-${candidate.player.id}`}
                  type="checkbox"
                  name="selected_player"
                  value={candidate.player.id}
                  checked={selectedForMatch}
                  onChange={(event) => toggleSelected(candidate.player.id, event.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor={`selected-${candidate.player.id}`} className="core-player-name whitespace-nowrap cursor-pointer">
                  {candidate.player.name}
                </label>
                <span className="caption" style={{ color: "var(--ink-muted)" }}>
                  {candidate.selectedLastEight}/8 senaste · {candidate.matchCount} matcher
                </span>
                <span className="caption" style={{ color: "var(--ink-muted)" }}>
                  Möj: {opportunitiesText}
                </span>
                <span className="caption" style={{ color: "var(--ink-muted)" }}>
                  Varning: {cautionsText}
                </span>
                <span className="caption" style={{ color: "var(--ink-muted)" }}>
                  Mål: {goalsText}
                </span>
                <label className="flex items-center gap-1.5 ml-auto">
                  <span className="caption">Pos</span>
                  <select
                    name={`position_${candidate.player.id}`}
                    className="input mt-0 w-28"
                    value={positions[candidate.player.id] ?? ""}
                    onChange={(event) => setPositions((current) => ({ ...current, [candidate.player.id]: event.target.value }))}
                  >
                    {POSITIONS.map((position) => <option key={position || "none"} value={position}>{position || "Ej satt"}</option>)}
                  </select>
                </label>
              </div>
            </article>
          );
        })}
        <div className="sticky bottom-20 md:bottom-4 flex justify-end">
          <button type="submit" className="btn-primary shadow-lg">Spara uttagning</button>
        </div>
      </form>
    </>
  );
}
