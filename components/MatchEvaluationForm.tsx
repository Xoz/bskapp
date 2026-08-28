"use client";

import { useState } from "react";
import {
  IMPACT_LABELS, MATCH_IMPACTS, REASON_LABELS, REASON_TAGS,
  SELF_COMPARISONS, SELF_LABELS, type MatchImpact, type SelfComparison,
} from "@/lib/matchEvaluationTypes";

type WebMatchEvaluationPlayer = {
  id: number;
  name: string;
  jerseyNumber: number | null;
  level: string;
  selfComparison: string | null;
  matchImpact: string | null;
  reasonTag: string;
  skipped: boolean;
};

type MatchContext = {
  ourScore: number | null;
  opponentScore: number | null;
  hasLiveData: boolean;
  coachComment: string;
};

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
  matchContext,
  saveAction,
}: {
  players: WebMatchEvaluationPlayer[];
  matchContext?: MatchContext;
  saveAction: (formData: FormData) => Promise<void>;
}) {
  const [answers, setAnswers] = useState<Record<number, Answer>>(() =>
    Object.fromEntries(players.map((player) => [player.id, {
      self: player.selfComparison as SelfComparison | null,
      impact: player.matchImpact as MatchImpact | null,
      reason: player.reasonTag,
      skipped: player.skipped,
    }]))
  );
  const [activeIndex, setActiveIndex] = useState(() => {
    const firstUnfinished = players.findIndex((player) => !isHandled({
      self: player.selfComparison as SelfComparison | null,
      impact: player.matchImpact as MatchImpact | null,
      reason: player.reasonTag,
      skipped: player.skipped,
    }));
    return firstUnfinished >= 0 ? firstUnfinished : Math.max(0, players.length - 1);
  });

  const player = players[activeIndex];
  const answer = player ? answers[player.id] : undefined;
  const handled = players.filter((item) => isHandled(answers[item.id])).length;
  const skipped = players.filter((item) => answers[item.id]?.skipped).length;
  const allHandled = handled === players.length;
  const isLast = activeIndex === players.length - 1;

  const update = (change: Partial<Answer>) => {
    if (!player) return;
    setAnswers((current) => ({
      ...current,
      [player.id]: { ...current[player.id], ...change, skipped: false },
    }));
  };
  const skipPlayer = () => {
    if (!player) return;
    setAnswers((current) => ({
      ...current,
      [player.id]: { self: null, impact: null, reason: "", skipped: true },
    }));
    if (!isLast) setActiveIndex((current) => current + 1);
  };

  return <form action={saveAction} className="space-y-4">
    {matchContext && (
    <section className="core-panel core-form-panel space-y-5">
      <div>
        <p className="core-kicker mb-1">Matchens sammanfattning</p>
        <h2 className="core-section-title">Resultat och tränarkommentar</h2>
      </div>
      {matchContext.hasLiveData ? <div className="flex items-center justify-between gap-4 rounded-xl p-4" style={{ background: "var(--elevated)" }}>
        <span className="body-small" style={{ color: "var(--ink-secondary)" }}>Slutresultat från Matchcenter</span>
        <strong className="stat-number text-xl">{matchContext.ourScore ?? "–"}–{matchContext.opponentScore ?? "–"}</strong>
        <input type="hidden" name="our_score" value={matchContext.ourScore ?? ""} />
        <input type="hidden" name="opponent_score" value={matchContext.opponentScore ?? ""} />
      </div> : <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3 max-w-sm">
        <label><span className="label">BSK</span><input className="input mt-2 text-center" type="number" min="0" max="99" name="our_score" defaultValue={matchContext.ourScore ?? ""} /></label>
        <span className="pb-3 font-semibold">–</span>
        <label><span className="label">Motståndare</span><input className="input mt-2 text-center" type="number" min="0" max="99" name="opponent_score" defaultValue={matchContext.opponentScore ?? ""} /></label>
      </div>}
      <label className="block"><span className="label">Tränarkommentar</span>
        <textarea className="input mt-2" name="coach_comment" rows={3} maxLength={4000} defaultValue={matchContext.coachComment} placeholder="Kort sammanfattning för matchanalysen…" />
      </label>
      {players.length === 0 && <p className="body-small" style={{ color: "var(--ink-secondary)" }}>Det finns ingen registrerad matchtrupp. Resultat och kommentar kan ändå sparas och uppföljningen avslutas.</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" type="submit" name="save_context" value="1">Spara matchinfo</button>
        <button className="btn-secondary" type="submit" name="complete_without_players" value="1" style={{ color: "var(--warning)" }}>Avsluta utan spelarbedömningar</button>
      </div>
    </section>
    )}

    {player && answer && <>
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
        {player.jerseyNumber != null && <span className="badge">#{player.jerseyNumber}</span>}
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
    </>}
  </form>;
}
