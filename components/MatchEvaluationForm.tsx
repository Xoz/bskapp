"use client";

import { useState } from "react";
import { IMPACT_LABELS, MATCH_IMPACTS, REASON_LABELS, REASON_TAGS, SELF_COMPARISONS, SELF_LABELS, type MatchImpact, type SelfComparison } from "@/lib/matchEvaluationTypes";
import type { MatchEvaluationPlayer } from "@/lib/matchEvaluation";

type Answer = { self: SelfComparison | null; impact: MatchImpact | null; reason: string };

export default function MatchEvaluationForm({ players, saveAction }: { players: MatchEvaluationPlayer[]; saveAction: (formData: FormData) => Promise<void> }) {
  const [answers, setAnswers] = useState<Record<number, Answer>>(() => Object.fromEntries(players.map((player) => [
    player.id,
    { self: player.self_comparison, impact: player.match_impact, reason: player.reason_tag },
  ])));
  const completed = players.filter((player) => answers[player.id]?.self && answers[player.id]?.impact).length;
  const update = (playerId: number, change: Partial<Answer>) => setAnswers((current) => ({
    ...current,
    [playerId]: { ...current[playerId], ...change },
  }));

  return <form action={saveAction} className="space-y-4">
    <div className="core-panel p-4 flex items-center justify-between gap-3 sticky top-3 z-10">
      <p className="body-small"><strong>{completed} av {players.length}</strong> spelare klara</p>
      <span className="badge badge-primary">{completed === players.length ? "Klart att spara" : "Pågår"}</span>
    </div>
    {players.map((player) => {
      const answer = answers[player.id];
      return <article key={player.id} className="core-panel core-form-panel">
      <div className="flex items-center justify-between gap-3"><h2 className="core-section-title">{player.name}</h2>
        {player.jersey_number != null && <span className="badge">#{player.jersey_number}</span>}</div>
      <fieldset className="mt-5"><legend className="label mb-2">Jämfört med sin vanliga nivå</legend>
        <div className="grid grid-cols-3 gap-2">{SELF_COMPARISONS.map((value) =>
          <button key={value} type="button" aria-pressed={answer.self === value}
            className={answer.self === value ? "btn-primary" : "btn-secondary"}
            onClick={() => update(player.id, { self: value })}>{SELF_LABELS[value]}</button>)}</div>
        <input type="hidden" name={`self_${player.id}`} value={answer.self ?? ""} />
      </fieldset>
      <fieldset className="mt-4"><legend className="label mb-2">På den här matchnivån</legend>
        <div className="grid grid-cols-3 gap-2">{MATCH_IMPACTS.map((value) =>
          <button key={value} type="button" aria-pressed={answer.impact === value}
            className={answer.impact === value ? "btn-primary" : "btn-secondary"}
            onClick={() => update(player.id, { impact: value })}>{IMPACT_LABELS[value]}</button>)}</div>
        <input type="hidden" name={`impact_${player.id}`} value={answer.impact ?? ""} />
      </fieldset>
      <label className="block mt-4"><span className="label">Orsakstagg, frivilligt</span>
        <select className="input mt-1" name={`reason_${player.id}`} value={answer.reason} onChange={(event) => update(player.id, { reason: event.target.value })}>
          {REASON_TAGS.map((value) => <option key={value} value={value}>{REASON_LABELS[value]}</option>)}
        </select></label>
    </article>;
    })}
    <div className="sticky bottom-3 flex justify-end"><button className="btn-primary" type="submit" disabled={completed === 0}>Spara utvärdering</button></div>
  </form>;
}
