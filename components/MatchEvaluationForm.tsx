import { IMPACT_LABELS, MATCH_IMPACTS, REASON_LABELS, REASON_TAGS, SELF_COMPARISONS, SELF_LABELS, type MatchEvaluationPlayer } from "@/lib/matchEvaluation";

export default function MatchEvaluationForm({ players, action }: { players: MatchEvaluationPlayer[]; action: (formData: FormData) => Promise<void> }) {
  return <form action={action} className="space-y-4">
    {players.map((player) => <article key={player.id} className="core-panel core-form-panel">
      <div className="flex items-center justify-between gap-3"><h2 className="core-section-title">{player.name}</h2>
        {player.jersey_number != null && <span className="badge">#{player.jersey_number}</span>}</div>
      <fieldset className="mt-5"><legend className="label mb-2">Jämfört med sin vanliga nivå</legend>
        <div className="grid grid-cols-3 gap-2">{SELF_COMPARISONS.map((value) =>
          <label key={value} className="btn-secondary text-center cursor-pointer has-[:checked]:border-[var(--primary)] has-[:checked]:text-[var(--primary)]">
            <input className="sr-only" type="radio" name={`self_${player.id}`} value={value} defaultChecked={player.self_comparison === value} />{SELF_LABELS[value]}
          </label>)}</div>
      </fieldset>
      <fieldset className="mt-4"><legend className="label mb-2">På den här matchnivån</legend>
        <div className="grid grid-cols-3 gap-2">{MATCH_IMPACTS.map((value) =>
          <label key={value} className="btn-secondary text-center cursor-pointer has-[:checked]:border-[var(--primary)] has-[:checked]:text-[var(--primary)]">
            <input className="sr-only" type="radio" name={`impact_${player.id}`} value={value} defaultChecked={player.match_impact === value} />{IMPACT_LABELS[value]}
          </label>)}</div>
      </fieldset>
      <label className="block mt-4"><span className="label">Orsakstagg, frivilligt</span>
        <select className="input mt-1" name={`reason_${player.id}`} defaultValue={player.reason_tag}>
          {REASON_TAGS.map((value) => <option key={value} value={value}>{REASON_LABELS[value]}</option>)}
        </select></label>
    </article>)}
    <div className="sticky bottom-3 flex justify-end"><button className="btn-primary" type="submit">Spara utvärdering</button></div>
  </form>;
}
