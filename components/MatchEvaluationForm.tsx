"use client";

import { useState } from "react";
import {
  IMPACT_LABELS, MATCH_IMPACTS, REASON_LABELS, REASON_TAGS,
  SELF_COMPARISONS, SELF_LABELS, type MatchImpact, type SelfComparison,
} from "@/lib/matchEvaluationTypes";
import type { MatchEvaluationPlayer } from "@/lib/matchEvaluation";

type Answer = {
  self: SelfComparison | null;
  impact: MatchImpact | null;
  reason: string;
  skipped: boolean;
};

const isHandled = (answer: Answer | undefined) =>
  Boolean(answer?.skipped || (answer?.self && answer?.impact));

export default function MatchEvaluationForm({
  players,
  saveAction,
}: {
  players: MatchEvaluationPlayer[];
  saveAction: (formData: FormData) => Promise<void>;
}) {
  const [answers, setAnswers] = useState<Record<number, Answer>>(() =>
    Object.fromEntries(players.map((player) => [player.id, {
      self: player.self_comparison,
      impact: player.match_impact,
      reason: player.reason_tag,
      skipped: Boolean(player.skipped),
    }]))
  );
  const [activeIndex, setActiveIndex] = useState(() => {
    const firstUnfinished = players.findIndex((player) => !isHandled({
      self: player.self_comparison,
      impact: player.match_impact,
      reason: player.reason_tag,
      skipped: Boolean(player.skipped),
    }));
    return firstUnfinished >= 0 ? firstUnfinished : Math.max(0, players.length - 1);
  });

  const player = players[activeIndex];
  const answer = answers[player.id];
  const handled = players.filter((item) => isHandled(answers[item.id])).length;
  const skipped = players.filter((item) => answers[item.id]?.skipped).length;
  const allHandled = handled === players.length;
  const isLast = activeIndex === players.length - 1;

  const update = (change: Partial<Answer>) => setAnswers((current) => ({
    ...current,
    [player.id]: { ...current[player.id], ...change, skipped: false },
  }));
  const skipPlayer = () => {
    setAnswers((current) => ({
      ...current,
      [player.id]: { self: null, impact: null, reason: "", skipped: true },
    }));
    if (!isLast) setActiveIndex((current) => current + 1);
  };

  return <form action={saveAction} className="space-y-4">
    <section className="core-panel overflow-hidden">
      <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
        <div>
          <p className="core-kicker mb-1">Spelare {activeIndex + 1} av {players.length}</p>
          <p className="body-small"><strong>{handled} hanterade</strong>{skipped > 0 ? ` · ${skipped} överhoppade` : ""}</p>
        </div>
        <span className={`badge ${allHandled ? "badge-primary" : ""}`}>{allHandled ? "Klart" : "Pågår"}</span>
      </div>
      <div className="grid gap-1 px-4 pb-4 sm:px-5" style={{ gridTemplateColumns: `repeat(${players.length}, minmax(0, 1fr))` }} aria-hidden="true">
        {players.map((item, index) => <span key={item.id} className="h-1 rounded-full" style={{
          background: index === activeIndex ? "var(--accent)" : isHandled(answers[item.id]) ? "var(--success)" : "var(--border)",
        }} />)}
      </div>
    </section>

    <article className="core-panel core-form-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="body-small mb-1" style={{ color: "var(--ink-secondary)" }}>Spelare {activeIndex + 1}</p>
          <h2 className="core-section-title">{player.name}</h2>
        </div>
        {player.jersey_number != null && <span className="badge">#{player.jersey_number}</span>}
      </div>

      {answer.skipped ? <div className="mt-6 rounded-2xl p-5 text-center" style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}>
        <p className="font-semibold">Spelaren hoppas över</p>
        <p className="body-small mt-1" style={{ color: "var(--ink-secondary)" }}>Ingen bedömning sparas för den här spelaren.</p>
        <button type="button" className="btn-secondary mt-4" onClick={() => update({})}>Bedöm spelaren istället</button>
      </div> : <>
        <fieldset className="mt-6">
          <legend className="label mb-3">Jämfört med sin vanliga nivå</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">{SELF_COMPARISONS.map((value) =>
            <button key={value} type="button" aria-pressed={answer.self === value}
              className={`${answer.self === value ? "btn-primary" : "btn-secondary"} min-h-12 w-full whitespace-normal`}
              onClick={() => update({ self: value })}>{SELF_LABELS[value]}</button>)}</div>
        </fieldset>
        <fieldset className="mt-5">
          <legend className="label mb-3">På den här matchnivån</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">{MATCH_IMPACTS.map((value) =>
            <button key={value} type="button" aria-pressed={answer.impact === value}
              className={`${answer.impact === value ? "btn-primary" : "btn-secondary"} min-h-12 w-full whitespace-normal`}
              onClick={() => update({ impact: value })}>{IMPACT_LABELS[value]}</button>)}</div>
        </fieldset>
        <label className="block mt-5"><span className="label">Orsakstagg, frivilligt</span>
          <select className="input mt-2" value={answer.reason} onChange={(event) => update({ reason: event.target.value })}>
            {REASON_TAGS.map((value) => <option key={value} value={value}>{REASON_LABELS[value]}</option>)}
          </select></label>
        <button type="button" className="btn-secondary w-full mt-5" onClick={skipPlayer}>Hoppa över spelaren</button>
        <p className="text-center body-small mt-2" style={{ color: "var(--ink-secondary)" }}>Använd om spelaren exempelvis blev skadad eller inte går att bedöma.</p>
      </>}
    </article>

    {players.map((item) => {
      const itemAnswer = answers[item.id];
      return <div key={item.id} hidden>
        <input type="hidden" name={`self_${item.id}`} value={itemAnswer.self ?? ""} />
        <input type="hidden" name={`impact_${item.id}`} value={itemAnswer.impact ?? ""} />
        <input type="hidden" name={`reason_${item.id}`} value={itemAnswer.reason} />
        <input type="hidden" name={`skip_${item.id}`} value={itemAnswer.skipped ? "1" : "0"} />
      </div>;
    })}

    <div className="core-panel p-3 grid grid-cols-2 gap-2 sticky bottom-3 z-10">
      <button className="btn-secondary" type="button" disabled={activeIndex === 0}
        onClick={() => setActiveIndex((current) => Math.max(0, current - 1))}>Föregående</button>
      {isLast ? <button className="btn-primary" type="submit" disabled={!allHandled}>Spara utvärdering</button> :
        <button className="btn-primary" type="button" disabled={!isHandled(answer)}
          onClick={() => setActiveIndex((current) => Math.min(players.length - 1, current + 1))}>Nästa spelare</button>}
    </div>
  </form>;
}
