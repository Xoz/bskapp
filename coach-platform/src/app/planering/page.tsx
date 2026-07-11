import { Badge, Card, PageHeader } from "@/components/ui";
import { removePeriod, upsertPeriod } from "@/app/actions";
import { listPeriods } from "@/repositories/postgres";
import { skills } from "@/data/demo";
import type { SeasonPeriod } from "@/domain/model";

export const dynamic = "force-dynamic";

function PeriodForm({ period }: { period?: SeasonPeriod }) {
  return <form action={upsertPeriod} className="edit-form">
    {period && <input name="id" type="hidden" value={period.id}/>}
    <input name="name" defaultValue={period?.name} placeholder="Periodnamn" required style={{ gridColumn: "1 / -1" }}/>
    <input name="theme" defaultValue={period?.theme} placeholder="Tema/fokus" required style={{ gridColumn: "1 / -1" }}/>
    <input name="startsOn" type="date" defaultValue={period?.startsOn} aria-label="Start" required/>
    <input name="endsOn" type="date" defaultValue={period?.endsOn} aria-label="Slut" required/>
    <button className="button primary" style={{ gridColumn: "1 / -1" }}>{period ? "Spara" : "Skapa period"}</button>
  </form>;
}

export default async function PlanningPage() {
  const periods = await listPeriods();
  return <div className="page"><PageHeader eyebrow="SÄSONG 2026" title="Säsongsplan"><details className="create-panel"><summary className="button primary">+ Ny period</summary><PeriodForm/></details></PageHeader>
    <Card title="Säsongstidslinje" meta={`${periods.length} perioder`}>
      {periods.length ? <div className="timeline">{periods.map((period, index) => <article key={period.id} className={`period p${(index % 3) + 1}`}><Badge tone={index === 2 ? "amber" : "green"}>{index === periods.length - 1 ? "KOMMANDE" : "PLANERAD"}</Badge><h3>{period.name}</h3><p>{period.theme}</p><small>{period.startsOn} – {period.endsOn}</small><details><summary>Redigera</summary><PeriodForm period={period}/><form action={removePeriod}><input name="id" type="hidden" value={period.id}/><button className="delete-button">Ta bort</button></form></details></article>)}</div> : <p className="editor-help">Inga perioder än — skapa den första med knappen ovan.</p>}
    </Card>
    <div className="grid two">
      <Card title="Pedagogisk fördelning" meta="7 mot 7 · riktlinje"><div className="allocation"><span style={{ width: "40%" }}>Teknik 40%</span><span style={{ width: "25%" }}>Passning 25%</span><span style={{ width: "20%" }}>Beslut 20%</span><span style={{ width: "15%" }}>Övrigt 15%</span></div></Card>
      <Card title="Färdigheter i planen" meta={`${skills.length} prioriterade`}><div className="tags">{skills.map(skill => <span key={skill.id}>{skill.name}</span>)}</div></Card>
    </div>
  </div>;
}