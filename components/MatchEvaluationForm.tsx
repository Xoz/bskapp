"use client";
import { useState, useTransition } from "react";
import { RATING_LABELS } from "@/lib/matchRating";
import { levelLabel } from "@/lib/levels";
import './match-ratings.css';
type Player = { id: number; name: string; rating?: number | null; ratingComment?: string; selfComparison?: string | null };
type MatchContext = { ourScore: number | null; opponentScore: number | null; hasLiveData: boolean; coachComment: string };
export default function MatchEvaluationForm({ players, matchContext, matchLevel, saveAction }: {
  players: Player[]; matchContext?: MatchContext; matchLevel?: string; saveAction: (data: FormData) => Promise<void>;
}) {
  const [answers, setAnswers] = useState<Record<number, number | null>>(() => Object.fromEntries(players.map(p => [p.id, p.rating ?? null])));
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const rated = Object.values(answers).filter(v => v != null).length;
  return <form action={data => { setError(''); startTransition(async () => { try { await saveAction(data); } catch (e) {
    if (e instanceof Error && e.message === 'NEXT_REDIRECT') throw e;
    setError(e instanceof Error ? e.message : 'Kunde inte spara. Dina val finns kvar.');
  } }); }} className="space-y-4">
    <section className="core-panel rating-panel">
      <div className="rating-heading"><div><h2 className="core-section-title">Deltagarnas prestation</h2><p className="body-small">Matchnivå: <strong>{levelLabel(matchLevel) || 'Ej angiven'}</strong></p></div><span className="badge">{rated} av {players.length} bedömda</span></div>
      {!levelLabel(matchLevel) && <p className="body-small mt-2">Ange matchens svårighetsgrad på matchsidan före bedömningen för att poängen ska kunna ge nivåunderlag.</p>}
      <p className="body-small mt-3">Välj en poäng per spelare. Tom rad betyder ej bedömd. Tryck på valt tal igen för att rensa.</p>
      <details className="mt-3"><summary className="body-small cursor-pointer">Så fungerar skalan 1–5</summary><ol className="mt-2 space-y-1">{RATING_LABELS.map((label, i) => <li key={label}><strong>{i + 1}</strong> · {label}</li>)}</ol><p className="body-small mt-2">Bedöm prestationen på matchens svårighetsgrad. 3 betyder att spelaren klarade nivån.</p></details>
      <div className="rating-grid-head" aria-hidden="true"><span>Spelare</span>{RATING_LABELS.map((_, i) => <span key={i}>{i + 1}</span>)}</div>
      {players.map(p => <div className="rating-player" key={p.id}>
        <div className="rating-row"><strong className="rating-name">{p.name}</strong>{RATING_LABELS.map((label, i) => <button type="button" key={label} aria-label={`${p.name}: ${i + 1} – ${label}`} aria-pressed={answers[p.id] === i + 1} className="rating-choice" onClick={() => setAnswers(a => ({ ...a, [p.id]: a[p.id] === i + 1 ? null : i + 1 }))}>{i + 1}</button>)}</div>
        <input type="hidden" name={`rating_${p.id}`} value={answers[p.id] ?? ''} disabled={Boolean(p.selfComparison && p.rating == null && answers[p.id] == null)} />
        {p.selfComparison && p.rating == null && <p className="caption">Äldre bedömning finns kvar. Välj en poäng för att ersätta den.</p>}
        <details className="rating-comment"><summary>Kommentar{p.ratingComment ? ' · finns' : ', frivilligt'}</summary><textarea className="input mt-2" name={`comment_${p.id}`} aria-label={`Kommentar för ${p.name}`} maxLength={1000} rows={2} defaultValue={p.ratingComment ?? ''} /></details>
      </div>)}
      {!players.length && <p className="body-small mt-4">Inga registrerade deltagare. Registrera deltagande innan du bedömer spelarna.</p>}
    </section>
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
      {players.length === 0 && <p className="body-small" style={{ color: "var(--ink-secondary)" }}>Det finns inga registrerade deltagare att utvärdera. Resultat och kommentar kan ändå sparas och uppföljningen avslutas.</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" type="submit" name="save_context" value="1">Spara matchinfo</button>
        <button className="btn-secondary" type="submit" name="complete_without_players" value="1" style={{ color: "var(--warning)" }}>Avsluta utan spelarbedömningar</button>
      </div>
    </section>
    )}


    {error && <p role="alert" className="core-panel p-4">{error}</p>}
    {players.length > 0 && <div className="rating-save core-panel p-3"><span className="body-small">{rated} bedömda · {players.length - rated} ej bedömda</span><button className="btn-primary" type="submit" disabled={pending}>{pending ? 'Sparar…' : 'Spara utvärdering'}</button></div>}
  </form>;
}
