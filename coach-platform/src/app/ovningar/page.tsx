import Link from "next/link";
import { Badge, PageHeader } from "@/components/ui";
import { ExerciseGrid } from "@/components/ExerciseGrid";
import { removeExercise, upsertExercise } from "@/app/actions";
import { listExercises } from "@/repositories/postgres";

export const dynamic = "force-dynamic";

function ExerciseForm({ exercise }: { exercise?: Awaited<ReturnType<typeof listExercises>>[number] }) {
  return <form action={upsertExercise} className="edit-form">
    {exercise && <input name="id" type="hidden" value={exercise.id}/>}<input name="name" defaultValue={exercise?.name} placeholder="Namn" required/><input name="summary" defaultValue={exercise?.summary} placeholder="Kort beskrivning" required/><input name="durationMinutes" type="number" defaultValue={exercise?.durationMinutes ?? 15} aria-label="Minuter" min={1} required/><input name="minPlayers" type="number" defaultValue={exercise?.players[0] ?? 4} aria-label="Minsta antal spelare" min={1} required/><input name="maxPlayers" type="number" defaultValue={exercise?.players[1] ?? 14} aria-label="Största antal spelare" min={1} required/><button className="button primary">{exercise ? "Spara" : "Skapa"}</button>
  </form>;
}

export default async function ExercisesPage() {
  const exercises = await listExercises();
  return <div className="page"><PageHeader eyebrow="BIBLIOTEK" title={`Övningar (${exercises.length})`}><details className="create-panel"><summary className="button primary">+ Ny övning</summary><ExerciseForm/></details></PageHeader>
    <ExerciseGrid exercises={exercises}>{(exercise, index) => <article className="exercise-card" key={exercise.id}><div className={`pitch pitch-${index % 3}`}><span>↗</span><i/><i/><i/></div><div><div className="badge-row"><Badge tone={index % 3 === 0 ? "blue" : "green"}>7v7</Badge><small>{exercise.durationMinutes} min</small></div><h2>{exercise.name}</h2><p>{exercise.summary}</p><footer><span>{exercise.players[0]}–{exercise.players[1]} spelare</span><Link href={`/ovningar/${exercise.id}/ritare`} className="button" style={{ padding:"6px 12px" }}>Rita</Link></footer><details><summary>Redigera</summary><ExerciseForm exercise={exercise}/><form action={removeExercise}><input name="id" type="hidden" value={exercise.id}/><button className="delete-button">Ta bort</button></form></details></div></article>}</ExerciseGrid>
  </div>;
}