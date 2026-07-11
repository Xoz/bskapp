import { Badge, PageHeader } from "@/components/ui";
import { exercises, skills } from "@/data/demo";

export default function ExercisesPage() {
  return <div className="page"><PageHeader eyebrow="BIBLIOTEK" title={`Övningar (${exercises.length})`}><button className="button primary">+ Ny övning</button></PageHeader>
    <div className="filters"><input aria-label="Sök övning" placeholder="Sök namn, tema eller färdighet…"/><select aria-label="Spelform"><option>Alla spelformer</option><option>7 mot 7</option><option>9 mot 9</option></select><select aria-label="Färdighet"><option>Alla färdigheter</option>{skills.map(s => <option key={s.id}>{s.name}</option>)}</select></div>
    <div className="exercise-grid">{exercises.map((exercise, index) => <article className="exercise-card" key={exercise.id}><div className={`pitch pitch-${index % 3}`}><span>↗</span><i/><i/><i/></div><div><div className="badge-row"><Badge tone={index % 3 === 0 ? "blue" : "green"}>{exercise.gameFormats.join(" · ")}</Badge><small>{exercise.durationMinutes} min</small></div><h2>{exercise.name}</h2><p>{exercise.summary}</p><footer><span>{exercise.players[0]}–{exercise.players[1]} spelare</span><span>{"●".repeat(exercise.difficulty)}</span></footer></div></article>)}</div>
  </div>;
}
