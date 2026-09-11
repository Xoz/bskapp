import Link from "next/link";
import { IMPACT_LABELS, SELF_LABELS } from "@/lib/matchEvaluationTypes";
import { assessMatchLevel, RATING_RULES } from "@/lib/matchRating";
import { levelLabel } from "@/lib/levels";
import { swedishToday } from "@/lib/dates";
import type { MatchEvaluationTrendPoint } from "@/lib/matchEvaluation";

export default function MatchEvaluationTrend({ data }: { data: MatchEvaluationTrendPoint[] }) {
  const assessment = assessMatchLevel(data, swedishToday());
  return <section className="core-panel core-form-panel">
    <h2 className="core-section-title">Nivåunderlag från matcher</h2>
    <p className="mt-3"><strong>Visad nivå: {assessment.established?.label ?? 'Ännu inte etablerad'}</strong></p>
    {assessment.challenge && <p className="mt-1">Nästa steg: pröva <strong>{assessment.challenge.label}</strong></p>}
    {!data.some(row => row.rating != null) && <p className="body-small mt-2">Utvärdera deltagarna efter match med den nya skalan 1–5 för att bygga ett nivåunderlag.</p>}
    <div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><caption className="text-left mb-2">Senaste {RATING_RULES.windowDays} dagarna · snitt viktat efter datum</caption><thead><tr><th className="text-left py-2">Matchnivå</th><th>Snitt</th><th>Matcher</th></tr></thead><tbody>{assessment.levels.map(row => <tr key={row.id} style={{borderTop:'1px solid var(--border)'}}><th className="text-left py-2 font-medium">{row.label}</th><td className="text-center">{row.average?.toLocaleString('sv-SE',{minimumFractionDigits:1,maximumFractionDigits:1}) ?? '–'}</td><td className="text-center">{row.count}{row.count > 0 && row.count < RATING_RULES.minimumMatches ? ' · få matcher' : ''}</td></tr>)}</tbody></table></div>
    {assessment.unknown > 0 && <p className="body-small mt-2">{assessment.unknown} bedömda matcher saknar entydig matchnivå och ingår inte i nivåförslaget.</p>}
    <details className="mt-3"><summary className="body-small cursor-pointer">Så bedöms nivån</summary><p className="body-small mt-2">Minst fem matcher och ett viktat snitt på minst 3 krävs på samma nivå. Snitt på minst 4 föreslår att prova nivån närmast över. Senare matcher väger mer; vikten halveras efter 60 dagar. Varje match räknas en gång, med snittet av bedömarnas poäng. Höga poäng i lätta matcher etablerar inte en svårare nivå.</p><p className="body-small mt-2">Detta är ett förslag till tränaren. Fastställ eller justera matchnivån i profilens tränarbedömning. Äldre bedömningar ingår inte i poängunderlaget.</p></details>
    {data.length > 0 && <details className="mt-4"><summary className="cursor-pointer">Senaste matchbedömningar</summary><div className="mt-2">{data.slice(0,12).map(row => <article key={row.match_id} className="py-3" style={{borderTop:'1px solid var(--border)'}}><strong><Link href={`/matcher/${row.match_id}`}>{row.opponent}</Link></strong><p className="caption">{row.date} · {row.rating == null ? 'Äldre bedömning' : levelLabel(row.match_level) || 'Nivå saknas'}</p>{row.rating != null ? <p>{row.rating.toLocaleString('sv-SE',{maximumFractionDigits:1})} / 5 · {row.contributor_count} bedömare</p> : <p>{row.self_comparison ? SELF_LABELS[row.self_comparison] : ''} · {row.match_impact ? IMPACT_LABELS[row.match_impact] : ''}</p>}{row.rating_comment && <p className="body-small mt-1">{row.rating_comment}</p>}</article>)}</div></details>}
  </section>;
}
