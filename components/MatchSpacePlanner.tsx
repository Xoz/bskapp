"use client";
import MatchSpaceBar from "./MatchSpaceBar";
import Link from "next/link";
import { useState } from "react";
import { batteryPercent, forecastMatchSpace, spaceLabels, type SpaceInput } from "@/lib/matchSpace";

export default function MatchSpacePlanner({ players }: {players: {id:number; name:string; team:string; input:SpaceInput; status:string | null}[]}) {
  const [team, setTeam] = useState(players.some(p => p.team === "Gul") ? "Gul" : "Alla");
  const [minutes, setMinutes] = useState<Record<number,number>>({});
  const teams = [...new Set(players.map(p => p.team))].sort((a,b) => a.localeCompare(b,"sv"));
  const rows = players.filter(p => team === "Alla" || p.team === team).map(p => ({...p, forecast:forecastMatchSpace(p.input,minutes[p.id])}));
  const rank = {normal:0, maximum:1, high:2};
  rows.sort((a,b) => rank[a.forecast.level]-rank[b.forecast.level] || a.name.localeCompare(b.name,"sv"));
  return <div className="space-y-4">
    {players[0]?.input.sourceWarning && <p role="status" className="core-panel p-4 text-sm" style={{color:"var(--warning)"}}>{players[0].input.sourceWarning}</p>}
    <label className="flex items-center gap-3">Visa spelare från
      <select className="input" value={team} onChange={e => setTeam(e.target.value)}><option>Alla</option>{teams.map(t => <option key={t}>{t}</option>)}</select>
    </label>
    <details className="core-panel p-4 text-sm">
      <summary className="cursor-pointer">Så räknas matchutrymmet</summary>
      <p className="mt-3">Prognosen räknar med denna match en gång för varje spelare, även om hon ännu inte är kallad. Därefter kontrolleras planerade aktiviteter under sju dagar. Kallelsesvaret visas separat.</p>
      <p className="mt-2">Kapaciteten ställs in på spelarprofilen. Fullt batteri visas alltid som 100 %, även med individuell justering. Batteriet förbrukas vid spel och fylls på mellan aktiviteter. Under 40 % av kapaciteten: prioritera vila. Under 50 %: begränsat utrymme.</p>
      <p className="mt-2">Uppskattning: utespelarna delar på 6 × 60 minuter i 7 mot 7 eller 8 × 75 i 9 mot 9, delat på deltagarna utom målvakten. Målvakten får full matchtid. Träning räknas som 60 minuter. Historiken börjar för 28 dagar sedan med antaget fullt batteri. Andra idrotter och saknad närvaro ingår inte. Ändrad speltid här är bara ett scenario och sparas inte i matchplanen.</p>
    </details>
    {rows.map(({id,name,team:playerTeam,input,status,forecast:f}) => <article key={id} className="core-panel p-4 space-y-3">
      <div className="flex justify-between items-start gap-3"><div><Link className="font-semibold underline" href={`/spelare/${id}`}>{name}</Link><p className="text-sm">{playerTeam} · {status === "accepted" ? "Tackat ja" : status === "declined" ? "Tackat nej" : status === "pending" ? "Inväntar svar" : "Inte kallad"}</p></div>
        <span className="text-sm text-right" style={{color:f.level === "high" ? "var(--danger)" : f.level === "maximum" ? "var(--warning)" : "var(--ink-secondary)"}}>{spaceLabels[f.level]}</span>
      </div>
      <MatchSpaceBar forecast={f}/>
      <p className="text-xs" style={{color:"var(--ink-secondary)"}}>Inför match {batteryPercent(f.before,f.capacity)} % · efter match {batteryPercent(f.after,f.capacity)} %</p>
      <div className="flex justify-between items-center gap-3 flex-wrap"><label className="text-sm">Prova speltid (min)
        <input aria-label={`Prova speltid för ${name}`} className="input ml-2" style={{width:"5rem"}} type="number" min={0} step="any" max={input.target!.duration} value={minutes[id] ?? Math.round(input.target!.minutes * 10) / 10} onChange={e => setMinutes(previous => ({...previous,[id]:Math.max(0,Math.min(input.target!.duration, Number(e.target.value)))}))}/>
      </label></div>
      {f.conflict && <p className="text-sm" style={{color:"var(--danger)"}}>Tidskrock med en annan aktivitet.</p>}
      {f.nextAffected && <p className="text-sm">Låg marginal vid {f.nextAffected}.</p>}
      <p className="text-xs" style={{color:"var(--ink-secondary)"}}>Uppskattad prognos{!input.events.some(e => !e.planned) ? " · Registrerad historik saknas; fullt batteri är ett antagande." : ""}</p>
    </article>)}
    {!rows.length && <p>Inga spelare i detta lag.</p>}
  </div>;
}
