import { Badge, Card, PageHeader } from "@/components/ui";
import { sessions } from "@/data/demo";
import { sessionMinutes } from "@/domain/training";

export default function SessionsPage() { return <div className="page"><PageHeader eyebrow="PLANERA OCH GENOMFÖR" title="Träningspass"><button className="button primary">+ Skapa pass</button></PageHeader><div className="stack">{sessions.map((session, index) => <Card key={session.id} title={session.title} meta={new Date(session.startsAt).toLocaleDateString("sv-SE")}><div className="session-row"><div><Badge tone={index === 0 ? "green" : "blue"}>{session.status === "planned" ? "PLANERAT" : "UTKAST"}</Badge><p>{session.theme} · {sessionMinutes(session)} minuter</p></div><ol>{session.blocks.map(block => <li key={block.id}><b>{block.minutes} min</b><span>{block.title}</span></li>)}</ol><button className="button">Öppna</button></div></Card>)}</div></div> }
