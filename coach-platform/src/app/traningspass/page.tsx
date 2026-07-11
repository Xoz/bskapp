import { Badge, Card, PageHeader } from "@/components/ui";
import { removeSession, upsertSession } from "@/app/actions";
import { sessionMinutes } from "@/domain/training";
import { listSessions } from "@/repositories/postgres";

export const dynamic = "force-dynamic";

function SessionForm({ session }: { session?: Awaited<ReturnType<typeof listSessions>>[number] }) {
  const localDate = session?.startsAt.slice(0, 16);
  return <form action={upsertSession} className="edit-form">
    {session && <input name="id" type="hidden" value={session.id}/>}<input name="title" defaultValue={session?.title} placeholder="Rubrik" required/><input name="theme" defaultValue={session?.theme} placeholder="Tema" required/><input name="startsAt" type="datetime-local" defaultValue={localDate} required/><input name="plannedMinutes" type="number" defaultValue={session?.plannedMinutes ?? 75} aria-label="Planerade minuter" min={1} required/><select name="status" defaultValue={session?.status === "planned" ? "planned" : "draft"}><option value="draft">Utkast</option><option value="planned">Planerat</option></select><button className="button primary">{session ? "Spara" : "Skapa"}</button>
  </form>;
}

export default async function SessionsPage() {
  const sessions = await listSessions();
  return <div className="page"><PageHeader eyebrow="PLANERA OCH GENOMFÖR" title="Träningspass"><details className="create-panel"><summary className="button primary">+ Skapa pass</summary><SessionForm/></details></PageHeader><div className="stack">{sessions.map(session => <Card key={session.id} title={session.title} meta={new Date(session.startsAt).toLocaleDateString("sv-SE")}><div className="session-row"><div><Badge tone={session.status === "planned" ? "green" : "blue"}>{session.status === "planned" ? "PLANERAT" : "UTKAST"}</Badge><p>{session.theme} · {sessionMinutes(session)} minuter</p></div><ol>{session.blocks.length ? session.blocks.map(block => <li key={block.id}><b>{block.minutes} min</b><span>{block.title}</span></li>) : <li>Inga block ännu</li>}</ol><details><summary className="button">Redigera</summary><SessionForm session={session}/><form action={removeSession}><input name="id" type="hidden" value={session.id}/><button className="delete-button">Ta bort</button></form></details></div></Card>)}</div></div>;
}
