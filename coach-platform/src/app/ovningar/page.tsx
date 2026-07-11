import { PageHeader } from "@/components/ui";
import { ExerciseGrid } from "@/components/ExerciseGrid";
import { ExerciseForm } from "@/components/ExerciseForm";
import { listExercises } from "@/repositories/postgres";

export const dynamic = "force-dynamic";

export default async function ExercisesPage() {
  const exercises = await listExercises();
  return <div className="page"><PageHeader eyebrow="BIBLIOTEK" title={`Övningar (${exercises.length})`}><details className="create-panel"><summary className="button primary">+ Ny övning</summary><ExerciseForm/></details></PageHeader>
    <ExerciseGrid exercises={exercises}/>
  </div>;
}