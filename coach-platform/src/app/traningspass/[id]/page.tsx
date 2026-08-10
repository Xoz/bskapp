import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { completeSessionAction, moveBlockAction, removeBlock, saveAttendanceAction, upsertBlock } from "@/app/actions";
import { getSession, listAttendance, listExercises, listPlayers } from "@/repositories/postgres";
import type { AttendanceStatus } from "@/repositories/postgres";

export const dynamic = "force-dynamic";

type Session = Awaited<ReturnType<typeof getSession>>;
type Block = NonNullable<Session>["blocks"][number];

const ATTENDANCE_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: "present", label: "Närvarande" },
  { value: "late", label: "Sent" },
  { value: "partial", label: "Delvis" },
  { value: "absent", label: "Frånvarande" },
  { value: "trial", label: "Provpass" },
];

const STATUS_TONE: Record<string, "green" | "blue" | "amber"> = { draft: "amber", planned: "blue", completed: "green" };
const STATUS_LABEL: Record<string, string> = { draft: "UTKAST", planned: "PLANERAT", completed: "GENOMFÖRT" };

function BlockForm({ sessionId, block, exercises }: { sessionId: string; block?: Block; exercises: { id: string; name: string }[] }) {
  return <form action={upsertBlock} className="edit-form">
    <input name="sessionId" type="hidden" value={sessionId}/>
    {block && <input name="id" type="hidden" value={block.id}/>}
    <select name="exerciseId" defaultValue={block?.exerciseId} required style={{ gridColumn: "1 / -1" }}>
      {exercises.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
    </select>
    <input name="minutes" type="number" defaultValue={block?.minutes ?? 15} aria-label="Minuter" min={1} required/>
    <input name="coach" defaultValue={block?.coach ?? ""} placeholder="Ansvarig tränare" aria-label="Ansvarig tränare"/>
    <input name="groupName" defaultValue={block?.groupName ?? ""} placeholder="Grupp" aria-label="Grupp"/>
    <input name="area" defaultValue={block?.area ?? ""} placeholder="Yta (t.ex. 15×15)" aria-label="Yta"/>
    <input name="equipment" defaultValue={block?.equipment.join(", ")} placeholder="Material (kommasep.)" aria-label="Material"/>
    <input name="coachingPoints" defaultValue={block?.coachingPoints.join(", ")} placeholder="Coachsteg (kommaseparerade)" style={{ gridColumn: "1 / -1" }}/>
    <button className="button primary" style={{ gridColumn: "1 / -1" }}>{block ? "Spara block" : "Lägg till block"}</button>
  </form>;
}

export default async function BuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, exercises, players, attendance] = await Promise.all([getSession(id), listExercises(), listPlayers(), listAttendance(id)]);
  if (!session) return <div className="page"><PageHeader eyebrow="TRÄNINGSPASS" title="Saknas"><Link className="button" href="/traningspass">← Tillbaka</Link></PageHeader></div>;
  const total = session.blocks.reduce((sum, b) => sum + b.minutes, 0);
  const status = session.status === "completed" ? "completed" : session.status === "planned" ? "planned" : "draft";
  const attByPlayer = new Map(attendance.map(a => [a.playerId, a.status]));
  const present = attendance.filter(a => a.status === "present").length;
  return <div className="page">
    <PageHeader eyebrow={new Date(session.startsAt).toLocaleDateString("sv-SE")} title={session.title}>
      <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
      <Link className="button primary" href={`/traningspass/${session.id}/kor`}>▶ Starta träningsläge</Link>
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
            {(block.groupName || block.coach || block.area || block.equipment.length) ? <p style={{ margin: "0 0 2px", color: "var(--muted)", fontSize: "12px" }}>{[block.groupName && `Grupp: ${block.groupName}`, block.coach && `Tränare: ${block.coach}`, block.area && `Yta: ${block.area}`, block.equipment.length && `Material: ${block.equipment.join(", ")}`].filter(Boolean).join(" · ")}</p> : null}
            {block.coachingPoints.length ? <p style={{ margin: 0, color: "var(--muted)", fontSize: "13px" }}>{block.coachingPoints.join(" · ")}</p> : null}
            <details><summary className="button" style={{ padding: "4px 10px" }}>Redigera</summary><BlockForm sessionId={session.id} block={block} exercises={exercises}/><form action={removeBlock}><input name="id" type="hidden" value={block.id}/><input name="sessionId" type="hidden" value={session.id}/><button className="delete-button">Ta bort block</button></form></details>
          </div>
        </div>;
      })}</div> : <p className="editor-help">Inga block ännu — lägg till det första nedan.</p>}
      <details className="create-panel" style={{ marginTop: "16px" }}><summary className="button primary">+ Lägg till block</summary><BlockForm sessionId={session.id} exercises={exercises}/></details>
    </Card>
    <div className="grid two">
      <Card title="Närvaro" meta={attendance.length ? `${present}/${attendance.length} närvarande` : `${players.length} spelare`}>
        {players.length ? <form action={saveAttendanceAction} className="stack">
          <input name="sessionId" type="hidden" value={session.id}/>
          {players.map(player => <label key={player.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px", alignItems: "center" }}>
            <span>{player.number ? `#${player.number} ` : ""}{player.name}</span>
            <select name={`att_${player.id}`} defaultValue={attByPlayer.get(player.id) ?? "present"} aria-label={`Närvaro ${player.name}`}>
              {ATTENDANCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>)}
          <button className="button primary">Spara närvaro</button>
        </form> : <p className="editor-help">Inga spelare i pilotlaget ännu.</p>}
      </Card>
      <Card title="Genomförande" meta={STATUS_LABEL[status]}>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: "14px" }}>
          {status === "completed" ? "Passet är markerat som genomfört. Återställ om du vill redigera block eller närvaro igen." : "Markera passet som genomfört när det är avklarat. Närvaro och block låses inte — du kan ändra i efterhand."}
        </p>
        <form action={completeSessionAction} style={{ marginTop: "16px" }}>
          <input name="id" type="hidden" value={session.id}/>
          <input name="status" type="hidden" value={status === "completed" ? "planned" : "completed"}/>
          <button className={status === "completed" ? "button" : "button primary"}>{status === "completed" ? "Återställ till planerat" : "Markera genomfört"}</button>
        </form>
      </Card>
    </div>
  </div>;
}
