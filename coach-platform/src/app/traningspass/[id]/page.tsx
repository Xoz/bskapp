import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { moveBlockAction, removeBlock, upsertBlock } from "@/app/actions";
import { getSession, listExercises } from "@/repositories/postgres";

export const dynamic = "force-dynamic";

type Session = Awaited<ReturnType<typeof getSession>>;
type Block = NonNullable<Session>["blocks"][number];

function BlockForm({ sessionId, block, exercises }: { sessionId: string; block?: Block; exercises: { id: string; name: string }[] }) {
  return <form action={upsertBlock} className="edit-form">
    <input name="sessionId" type="hidden" value={sessionId}/>
    {block && <input name="id" type="hidden" value={block.id}/>}
    <select name="exerciseId" defaultValue={block?.exerciseId} required style={{ gridColumn: "1 / -1" }}>
      {exercises.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
    </select>
    <input name="minutes" type="number" defaultValue={block?.minutes ?? 15} aria-label="Minuter" min={1} required/>
    <input name="coachingPoints" defaultValue={block?.coachingPoints.join(", ")} placeholder="Coachsteg (kommaseparerade)" style={{ gridColumn: "1 / -1" }}/>
    <button className="button primary" style={{ gridColumn: "1 / -1" }}>{block ? "Spara block" : "Lägg till block"}</button>
  </form>;
}

export default async function BuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, exercises] = await Promise.all([getSession(id), listExercises()]);
  if (!session) return <div className="page"><PageHeader eyebrow="TRÄNINGSPASS" title="Saknas"><Link className="button" href="/traningspass">← Tillbaka</Link></PageHeader></div>;
  const total = session.blocks.reduce((sum, b) => sum + b.minutes, 0);
  return <div className="page">
    <PageHeader eyebrow={new Date(session.startsAt).toLocaleDateString("sv-SE")} title={session.title}>
      <Link className="button" href="/traningspass">← Pass</Link>
    </PageHeader>
    <Card title="Övningsblocks" meta={`${session.blocks.length} block · ${total} min · planerat ${session.plannedMinutes} min`}>
      {session.blocks.length ? <div className="stack">{session.blocks.map((block, i) => {
        const exercise = exercises.find(e => e.id === block.exerciseId);
        return <div key={block.id} className="session-row" style={{ gridTemplateColumns: "auto 1fr auto", gap: "12px" }}>
          <div style={{ display: "grid", gap: "6px" }}>
            <form action={moveBlockAction}><input name="id" type="hidden" value={block.id}/><input name="sessionId" type="hidden" value={session.id}/><input name="dir" type="hidden" value="up"/><button className="button" disabled={i === 0} style={{ padding: "2px 8px" }}>↑</button></form>
            <form action={moveBlockAction}><input name="id" type="hidden" value={block.id}/><input name="sessionId" type="hidden" value={session.id}/><input name="dir" type="hidden" value="down"/><button className="button" disabled={i === session.blocks.length - 1} style={{ padding: "2px 8px" }}>↓</button></form>
          </div>
          <div>
            <Badge tone="blue">{block.minutes} min</Badge>
            <h3 style={{ margin: "6px 0 4px", fontSize: "17px" }}>{exercise?.name ?? block.title}</h3>
            {block.coachingPoints.length ? <p style={{ margin: 0, color: "var(--muted)", fontSize: "13px" }}>{block.coachingPoints.join(" · ")}</p> : null}
            <details><summary className="button" style={{ padding: "4px 10px" }}>Redigera</summary><BlockForm sessionId={session.id} block={block} exercises={exercises}/><form action={removeBlock}><input name="id" type="hidden" value={block.id}/><input name="sessionId" type="hidden" value={session.id}/><button className="delete-button">Ta bort block</button></form></details>
          </div>
        </div>;
      })}</div> : <p className="editor-help">Inga block ännu — lägg till det första nedan.</p>}
      <details className="create-panel" style={{ marginTop: "16px" }}><summary className="button primary">+ Lägg till block</summary><BlockForm sessionId={session.id} exercises={exercises}/></details>
    </Card>
  </div>;
}