"use client";

import { useState } from "react";
import { saveMatchRatings } from "@/lib/actions";
import { EXPECTATION_STEPS, RATING_AREAS, type ExpectationStep } from "@/lib/rating";
import { level as levelInfo } from "@/lib/levels";
import Avatar from "./Avatar";

export interface RatingPlayer {
  id: number;
  name: string;
  jersey_number: number | null;
  position: string;
  level: string;
  goals: number;
  assists: number;
  saves: number;
  interceptions: number;
  suggested: string; // föreslaget steg (nyckel)
  overall: string | null; // tidigare satt betyg
  scores: Record<string, number>; // tidigare områdesbetyg
}

const TONE_COLOR: Record<ExpectationStep["tone"], string> = {
  danger: "var(--danger)",
  warn: "#f59e0b",
  neutral: "var(--ink-secondary)",
  ok: "#4ade80",
  great: "#22c55e",
};

function keyForOutcome(outcome: number): string {
  return EXPECTATION_STEPS.find((s) => s.outcome === outcome)?.key ?? "as_expected";
}

function Segment({
  value,
  suggested,
  onChange,
  size = "md",
}: {
  value: string;
  suggested?: string;
  onChange: (key: string) => void;
  size?: "md" | "sm";
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {EXPECTATION_STEPS.map((step) => {
        const active = value === step.key;
        const isSuggested = suggested === step.key && !active;
        return (
          <button
            key={step.key}
            type="button"
            onClick={() => onChange(step.key)}
            title={isSuggested ? `${step.label} (förslag)` : step.label}
            className="rounded-lg font-medium transition-colors cursor-pointer"
            style={{
              padding: size === "sm" ? "0.3rem 0.5rem" : "0.4rem 0.65rem",
              fontSize: size === "sm" ? "0.72rem" : "0.8rem",
              background: active ? TONE_COLOR[step.tone] : "var(--surface)",
              color: active ? "#0e0f11" : "var(--ink-secondary)",
              border: isSuggested ? "1px dashed var(--primary)" : "1px solid transparent",
              fontWeight: active ? 700 : 500,
            }}
          >
            {size === "sm" ? step.short : step.label}
          </button>
        );
      })}
    </div>
  );
}

function PlayerRow({ player }: { player: RatingPlayer }) {
  const initial = player.overall ?? player.suggested;
  const [overall, setOverall] = useState(initial);
  const [advanced, setAdvanced] = useState(false);
  const [areas, setAreas] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const a of RATING_AREAS) {
      const prev = player.scores[a.id];
      init[a.id] = prev != null ? keyForOutcome(prev) : player.suggested;
    }
    return init;
  });
  const hadAdvanced = Object.keys(player.scores).length > 0;

  const l = levelInfo(player.level);
  const statBits: string[] = [];
  if (player.goals) statBits.push(`${player.goals} mål`);
  if (player.assists) statBits.push(`${player.assists} ass`);
  if (player.interceptions) statBits.push(`${player.interceptions} brytn`);
  if (player.position === "malvakt" && player.saves) statBits.push(`${player.saves} räddn`);

  return (
    <div className="py-4" style={{ borderTop: "1px solid var(--border)" }}>
      {/* dolda fält som postas */}
      <input type="hidden" name={`overall_${player.id}`} value={overall} />
      <input type="hidden" name={`suggested_${player.id}`} value={player.suggested} />
      {advanced && <input type="hidden" name={`adv_${player.id}`} value="1" />}
      {advanced &&
        RATING_AREAS.map((a) => (
          <input key={a.id} type="hidden" name={`area_${player.id}_${a.id}`} value={areas[a.id]} />
        ))}

      <div className="flex items-center gap-3 mb-2.5 flex-wrap">
        <Avatar name={player.name} jersey={player.jersey_number} size={34} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{player.name}</span>
            {l && (
              <span className="badge" style={{ background: "var(--surface)", color: l.color, fontSize: "0.62rem" }}>
                {l.short}
              </span>
            )}
          </div>
          {statBits.length > 0 && (
            <p className="caption mt-0.5" style={{ color: "var(--ink-muted)" }}>
              {statBits.join(" · ")}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          className="caption hover:underline cursor-pointer shrink-0"
          style={{ color: advanced ? "var(--primary)" : "var(--ink-muted)" }}
        >
          {advanced ? "Stäng områden" : hadAdvanced ? "Områden ✓" : "Per område"}
        </button>
      </div>

      {!advanced ? (
        <Segment value={overall} suggested={player.suggested} onChange={setOverall} />
      ) : (
        <div className="space-y-2 mt-1">
          {RATING_AREAS.map((a) => (
            <div key={a.id} className="flex items-center gap-3 flex-wrap">
              <span
                className="caption shrink-0"
                style={{ width: 92, color: a.color, fontWeight: 600 }}
              >
                {a.name}
              </span>
              <Segment
                size="sm"
                value={areas[a.id]}
                onChange={(key) => setAreas((s) => ({ ...s, [a.id]: key }))}
              />
            </div>
          ))}
          <p className="caption" style={{ color: "var(--ink-muted)" }}>
            Helhetsbetyget räknas som snittet av områdena.
          </p>
        </div>
      )}
    </div>
  );
}

export default function MatchRatings({
  matchId,
  players,
}: {
  matchId: number;
  players: RatingPlayer[];
}) {
  if (players.length === 0) {
    return (
      <p className="body-small" style={{ color: "var(--ink-muted)" }}>
        Inga spelare med speltid i matchen att betygsätta ännu.
      </p>
    );
  }
  return (
    <form action={saveMatchRatings}>
      <input type="hidden" name="match_id" value={matchId} />
      <p className="caption mb-1" style={{ color: "var(--ink-muted)" }}>
        Bedöm hur spelaren presterade <strong>mot förväntan</strong> – förväntan är redan
        justerad efter spelarens nivå och matchens svårighet. Streckad ram = appens förslag.
      </p>
      {players.map((p) => (
        <PlayerRow key={p.id} player={p} />
      ))}
      <div className="mt-4 flex justify-end">
        <button type="submit" className="btn-primary">
          Spara betyg
        </button>
      </div>
    </form>
  );
}
