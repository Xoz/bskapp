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
          <div><p className="core-kicker text-[11px]">Truppen just nu</p><h2 className="core-section-title mt-1 text-lg">{selected.length} uttagna</h2></div>
        </div>
        {selected.length > 0 ? (
          <p className="text-xs text-[var(--ink-muted)]" style={{ overflowWrap: "anywhere" }}>
            {selected.map((candidate) => candidate.player.name).join(", ")}
          </p>
        ) : (
          <p className="text-xs mt-2" style={{ color: "var(--ink-secondary)" }}>Markera en spelare för att lägga till henne i truppen.</p>
        )}
        <ul className="mt-2 space-y-0.5 text-[11px]">
          {warnings.map((warning) => (
            <li key={warning} style={{ color: "var(--ink)" }}>{warning}</li>
          ))}
        </ul>
      </section>

      <form action={action} className="mt-2">
        <PilotStartField />
        <ul className="divide-y divide-[var(--border)] border border-transparent">
          {candidates.map((candidate) => {
            const selectedForMatch = selectedIds.has(candidate.player.id);
            return (
              <li key={candidate.player.id} className={`py-1 leading-4 text-[11px] ${selectedForMatch ? "bg-[var(--primary-soft)]" : ""}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    id={`selected-${candidate.player.id}`}
                    type="checkbox"
                    name="selected_player"
                    value={candidate.player.id}
                    checked={selectedForMatch}
                    onChange={(event) => toggleSelected(candidate.player.id, event.target.checked)}
                    className="h-3.5 w-3.5 accent-[var(--primary)]"
                  />
                  <label htmlFor={`selected-${candidate.player.id}`} className="whitespace-nowrap cursor-pointer flex-1 overflow-hidden text-ellipsis">
                    {candidate.player.name}
                  </label>
                  <span className="tabular-nums" style={{ color: "var(--ink-muted)", minWidth: "2rem", textAlign: "right" }}>
                    {candidate.matchCount}
                  </span>
                  {selectedForMatch && (
                    <label className="flex items-center gap-1.5">
                      <span className="sr-only">Position</span>
                      <select
                        name={`position_${candidate.player.id}`}
                        className="input h-6 px-1.5 py-0.5 text-[11px] w-20"
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
        <div className="sticky bottom-20 md:bottom-4 flex justify-end">
          <button type="submit" className="btn-primary shadow-lg">Spara uttagning</button>
        </div>
      </form>
    </>
  );
}
