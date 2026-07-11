import { Badge, Card, PageHeader } from "@/components/ui";
import { removePeriod, upsertPeriod } from "@/app/actions";
import { listPeriods, listSkills } from "@/repositories/postgres";
import type { SeasonPeriod } from "@/domain/model";

export const dynamic = "force-dynamic";

function PeriodForm({ period, skills }: { period?: SeasonPeriod; skills: { id: string; name: string; category: string }[] }) {
  const selected = new Set(period?.skillIds ?? []);
  return <form action={upsertPeriod} className="edit-form">
    {period && <input name="id" type="hidden" value={period.id}/>}
    <input name="name" defaultValue={period?.name} placeholder="Periodnamn" required style={{ gridColumn: "1 / -1" }}/>
    <input name="theme" defaultValue={period?.theme} placeholder="Tema/fokus" required style={{ gridColumn: "1 / -1" }}/>
    <input name="startsOn" type="date" defaultValue={period?.startsOn} aria-label="Start" required/>
    <input name="endsOn" type="date" defaultValue={period?.endsOn} aria-label="Slut" required/>
    <fieldset style={{ gridColumn: "1 / -1", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px" }}>
      <legend style={{ fontSize: 12, color: "var(--muted)", padding: "0 6px" }}>Prioriterade färdigheter</legend>
      <div className="tags" style={{ gap: "5px" }}>
        {skills.map(skill => <label key={skill.id} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
          <input type="checkbox" name="skillIds" value={skill.id} defaultChecked={selected.has(skill.id)} style={{ accentColor: "var(--green)" }}/>
          {skill.name}
        </label>)}
      </div>
    </fieldset>
    <button className="button primary" style={{ gridColumn: "1 / -1" }}>{period ? "Spara" : "Skapa period"}</button>
  </form>;
}

export default async function PlanningPage() {
  const [periods, skills] = await Promise.all([listPeriods(), listSkills()]);
  const skillName = new Map(skills.map(s => [s.id, s.name]));
  return <div className="page"><PageHeader eyebrow="SÄSONG 2026" title="Säsongsplan"><details className="create-panel"><summary className="button primary">+ Ny period</summary><PeriodForm skills={skills}/></details></PageHeader>
    <Card title="Säsongstidslinje" meta={`${periods.length} perioder`}>
      {periods.length ? <div className="timeline">{periods.map((period, index) => <article key={period.id} className={`period p${(index % 3) + 1}`}><Badge tone={index === periods.length - 1 ? "amber" : "green"}>{index === periods.length - 1 ? "KOMMANDE" : "PLANERAD"}</Badge><h3>{period.name}</h3><p>{period.theme}</p><small>{period.startsOn} – {period.endsOn}</small>{period.skillIds.length ? <div className="tags" style={{ marginTop: 8, gap: 5 }}>{period.skillIds.map(id => <span key={id}>{skillName.get(id) ?? "?"}</span>)}</div> : null}<details><summary>Redigera</summary><PeriodForm period={period} skills={skills}/><form action={removePeriod}><input name="id" type="hidden" value={period.id}/><button className="delete-button">Ta bort</button></form></details></article>)}</div> : <p className="editor-help">Inga perioder än — skapa den första med knappen ovan.</p>}
    </Card>
    <div className="grid two">
      <Card title="Pedagogisk fördelning" meta="7 mot 7 · riktlinje"><div className="allocation"><span style={{ width: "40%" }}>Teknik 40%</span><span style={{ width: "25%" }}>Passning 25%</span><span style={{ width: "20%" }}>Beslut 20%</span><span style={{ width: "15%" }}>Övrigt 15%</span></div></Card>
      <Card title="Färdigheter i planen" meta={`${skills.length} tillgängliga`}><div className="tags">{skills.map(skill => <span key={skill.id}>{skill.name}</span>)}</div></Card>
    </div>
  </div>;
}