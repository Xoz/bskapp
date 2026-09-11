import Link from "next/link";
import { IMPACT_LABELS } from "@/lib/matchEvaluationTypes";
import type { MatchEvaluationTrendPoint } from "@/lib/matchEvaluation";

const labels = { above: "Över vanlig nivå", usual: "På vanlig nivå", below: "Under vanlig nivå" };
export default function MatchEvaluationTrend({ data }: { data: MatchEvaluationTrendPoint[] }) {
  if (!data.length) return null;
  const recent = data.slice(0, 6);
  return <section className="core-panel core-form-panel">
    <div className="profile-section-heading"><h2>Senaste matchbedömningar</h2><span className="profile-meta">{recent.length} bedömda matcher</span></div>
    <p className="profile-meta">Tränarnas bedömning jämfört med spelarens vanliga prestation.</p>
    <div className="profile-evaluation-counts">{(["above", "usual", "below"] as const).map(level => <span key={level}><strong>{recent.filter(row => row.self_comparison === level).length}</strong> {labels[level].toLowerCase()}</span>)}</div>
    <details className="profile-details"><summary>Visa matchbedömningarna</summary>
      {recent.map(row => <article key={row.match_id} className="profile-history-row">
        <div><h3><Link href={`/matcher/${row.match_id}`}>{row.opponent}</Link></h3><p className="profile-meta">{row.date} · {row.contributor_count} tränare</p></div>
        <div><p>{labels[row.self_comparison]} · {IMPACT_LABELS[row.match_impact]}</p>{row.disagreement && <p className="profile-meta">Tränarna har olika bild</p>}</div>
      </article>)}
    </details>
  </section>;
}
