import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { ConductSession } from "@/components/ConductSession";
import { emptyDiagram } from "@/domain/diagram";
import type { Diagram } from "@/domain/diagram";
import { getDiagram, getSession, listAttendance, listExercises, listPlayers } from "@/repositories/postgres";

export const dynamic = "force-dynamic";

export default async function ConductRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, exercises, players, attendance] = await Promise.all([getSession(id), listExercises(), listPlayers(), listAttendance(id)]);
  if (!session) return <div className="page"><PageHeader eyebrow="TRÄNINGSLÄGE" title="Saknas"><Link className="button" href="/traningspass">← Tillbaka</Link></PageHeader></div>;
  if (!session.blocks.length) return <div className="page"><PageHeader eyebrow="TRÄNINGSLÄGE" title={session.title}><Link className="button" href={`/traningspass/${id}`}>← Bygg pass först</Link></PageHeader><p className="editor-help">Passet har inga övningsblock ännu. Lägg till block i byggaren innan du startar träningsläget.</p></div>;
  const diagrams: Record<string, Diagram> = {};
  for (const block of session.blocks) {
    const d = await getDiagram(block.exerciseId);
    diagrams[block.exerciseId] = d ?? emptyDiagram();
  }
  return <ConductSession
    session={session}
    exercises={exercises.map(e => ({ id: e.id, name: e.name }))}
    players={players.map(p => ({ id: p.id, name: p.name, number: p.number }))}
    attendance={attendance}
    diagrams={diagrams}
  />;
}