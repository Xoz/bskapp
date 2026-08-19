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
        </div>
        {selected.length > 0 ? (
          <ol className="mt-3 pl-4 text-sm list-decimal space-y-0.5">
            {selected.map((candidate) => <li key={candidate.player.id}>{candidate.player.name}</li>)}
          </ol>
        ) : (
          <p className="body-small mt-3" style={{ color: "var(--ink-secondary)" }}>Markera en spelare för att lägga till henne i truppen.</p>
        )}
        <ul className="mt-3 space-y-1">
          {warnings.map((warning) => (
            <li key={warning} className="body-small" style={{ color: "var(--ink)" }}>{warning}</li>
          ))}
        </ul>
      </section>

      <form action={action} className="core-list">
        <PilotStartField />
        <ul className="mt-2 space-y-1">
          {candidates.map((candidate) => {
            const selectedForMatch = selectedIds.has(candidate.player.id);
            return (
              <li key={candidate.player.id} className={`rounded-lg border px-3 py-2 ${selectedForMatch ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--border)]"}`}>
                <div className="flex flex-wrap items-center gap-2.5">
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
                    {candidate.matchCount}
                  </span>
                  <label className="flex items-center gap-1.5 ml-auto">
                    <span className="sr-only">Position</span>
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
              </li>
            );
          })}
        </ul>
        <div className="sticky bottom-20 md:bottom-4 flex justify-end">
          <button type="submit" className="btn-primary shadow-lg">Spara uttagning</button>
        </div>
      </form>
    </>
  );
}
