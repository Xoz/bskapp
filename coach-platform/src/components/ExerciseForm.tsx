import { upsertExercise } from "@/app/actions";
import { listExercises } from "@/repositories/postgres";

export function ExerciseForm({ exercise }: { exercise?: Awaited<ReturnType<typeof listExercises>>[number] }) {
  return <form action={upsertExercise} className="edit-form">
    {exercise && <input name="id" type="hidden" value={exercise.id}/>}<input name="name" defaultValue={exercise?.name} placeholder="Namn" required/><input name="summary" defaultValue={exercise?.summary} placeholder="Kort beskrivning" required/><input name="durationMinutes" type="number" defaultValue={exercise?.durationMinutes ?? 15} aria-label="Minuter" min={1} required/><input name="minPlayers" type="number" defaultValue={exercise?.players[0] ?? 4} aria-label="Minsta antal spelare" min={1} required/><input name="maxPlayers" type="number" defaultValue={exercise?.players[1] ?? 14} aria-label="Största antal spelare" min={1} required/><button className="button primary">{exercise ? "Spara" : "Skapa"}</button>
  </form>;
}