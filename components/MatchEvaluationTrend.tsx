import { IMPACT_LABELS, SELF_LABELS } from "@/lib/matchEvaluationTypes";
import type { MatchEvaluationTrendPoint } from "@/lib/matchEvaluation";

export default function MatchEvaluationTrend({ data }: { data: MatchEvaluationTrendPoint[] }) {
  if (!data.length) return null;
  const recent = data.slice(0, 6);
  const above = recent.filter((row) => row.self_comparison === "above").length;
  const usual = recent.filter((row) => row.self_comparison === "usual").length;
  const below = recent.filter((row) => row.self_comparison === "below").length;
  const signal = above > below ? "Positiv utveckling" : below > above ? "Behöver följas upp" : "Stabil utveckling";
  return <details className="core-panel core-form-panel" open>
    <summary className="core-section-head cursor-pointer list-none"><div><p className="core-kicker">Senaste {recent.length} matcherna</p>
      <h2 className="core-section-title mt-2">Matchutveckling</h2></div><span className="badge badge-primary">{signal}</span></summary>
    <div className="grid grid-cols-3 gap-2 mt-4">
      <div className="core-panel p-3 text-center"><strong>{above}</strong><p className="caption">Bättre</p></div>
      <div className="core-panel p-3 text-center"><strong>{usual}</strong><p className="caption">Som vanligt</p></div>
      <div className="core-panel p-3 text-center"><strong>{below}</strong><p className="caption">Sämre</p></div>
    </div>
    <div className="core-list mt-4">{recent.map((row) => <article key={row.match_id} className="core-panel p-4 flex items-start justify-between gap-4 flex-wrap">
      <div><h3>{row.opponent}</h3><p className="caption mt-1" style={{ color: "var(--ink-muted)" }}>{row.date}</p></div>
      <div className="flex gap-2 flex-wrap"><span className="badge">{SELF_LABELS[row.self_comparison]}</span>
        <span className="badge">{IMPACT_LABELS[row.match_impact]}</span>{row.disagreement && <span className="badge">Olika bild</span>}</div>
    </article>)}</div>
  </details>;
}
