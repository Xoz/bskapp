"use client";

import { useState } from "react";
import { saveCupSquad } from "@/lib/actions";
import { fit, level as levelInfo } from "@/lib/levels";
import { positionLabel } from "@/lib/positions";

export interface CupSquadPlayer {
  id: number;
  name: string;
  jersey_number: number | null;
  position: string;
  level: string;
}

function firstName(name: string) {
  return name.replace(/^Exempel:\s*/, "").split(" ")[0];
}

// Cupgemensam laguttagning: vilka spelare som är uttagna till hela cupen. Sparas
// som medlemskap i cupens matchgrupp och blir default-trupp per match.
export default function CupSquadPicker({
  cupName,
  cupGroup,
  cupLevel,
  players,
  initialSquad,
}: {
  cupName: string;
  cupGroup: string;
  cupLevel: string;
  players: CupSquadPlayer[];
  initialSquad: number[];
}) {
  const [squad, setSquad] = useState<Set<number>>(() => new Set(initialSquad));

  const toggle = (id: number) =>
    setSquad((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <form action={saveCupSquad} className="space-y-4">
      <input type="hidden" name="cup_name" value={cupName} />
      <input type="hidden" name="cup_group" value={cupGroup} />

      <div className="flex flex-wrap gap-2">
        {players.map((p) => {
          const inSquad = squad.has(p.id);
          const f = fit(p.level, cupLevel);
          const pl = levelInfo(p.level);
          const tone =
            f.tone === "ok" ? "var(--success)" : f.tone === "warn" ? "var(--warning)" : f.tone === "danger" ? "var(--danger)" : "var(--ink-muted)";
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              title={`${positionLabel(p.position) ?? "Position ej satt"} · ${f.label}`}
              className="flex items-center gap-2 rounded-full pl-2 pr-3 py-1.5 text-sm transition-colors"
              style={{
                background: inSquad ? "var(--primary-soft)" : "var(--surface)",
                border: `1px solid ${inSquad ? "var(--primary)" : "var(--border)"}`,
                color: inSquad ? "var(--primary)" : "var(--ink-secondary)",
                borderLeft: `4px solid ${tone}`,
              }}
            >
              <span className="stat-number text-xs" style={{ minWidth: 16, textAlign: "center", color: "var(--ink-muted)" }}>
                {p.jersey_number ?? "–"}
              </span>
              {firstName(p.name)}
              {pl && <span className="caption" style={{ color: tone }}>{pl.short}</span>}
            </button>
          );
        })}
      </div>

      {[...squad].map((id) => (
        <input key={id} type="hidden" name="player_id" value={id} />
      ))}

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary px-6">Spara uttagning</button>
        <span className="caption" style={{ color: "var(--ink-muted)" }}>{squad.size} uttagna</span>
      </div>
    </form>
  );
}
