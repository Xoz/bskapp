import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { ExerciseEditor } from "@/components/diagram/ExerciseEditor";
import { getDiagram, getExercise } from "@/repositories/postgres";
import { emptyDiagram } from "@/domain/diagram";

export const dynamic = "force-dynamic";

export default async function RitarePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exercise = await getExercise(id);
  if (!exercise) return <div className="page"><PageHeader eyebrow="ÖVNINGAR" title="Saknas"><p className="editor-help">Övningen finns inte i pilotorganisationen.</p><Link className="button" href="/ovningar">Tillbaka</Link></PageHeader></div>;
  const diagram = (await getDiagram(id)) ?? emptyDiagram();
  return (
    <div className="page">
      <PageHeader eyebrow="RITARE" title={exercise.name}>
        <Link className="button" href="/ovningar">← Övningar</Link>
      </PageHeader>
      <ExerciseEditor exerciseId={exercise.id} name={exercise.name} initialDiagram={diagram} />
    </div>
  );
}