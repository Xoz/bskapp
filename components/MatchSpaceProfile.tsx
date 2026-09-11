"use client";
import { useState, useTransition } from "react";
import { saveMatchSpaceCapacity } from "@/lib/matchSpaceActions";
import { forecastMatchSpace, spaceLabels, type SpaceInput } from "@/lib/matchSpace";

export default function MatchSpaceProfile({ playerId, input, canEdit }: {playerId: number; input: SpaceInput; canEdit: boolean}) {
  const [capacity, setCapacity] = useState(input.capacity);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const forecast = forecastMatchSpace(input);
  return <section className="core-panel p-5 space-y-3">
    <h2 className="core-section-title">Matchutrymme</h2>
    {input.sourceWarning && <p className="text-sm" style={{color:"var(--warning)"}}>{input.sourceWarning}</p>}
    <p><strong>{forecast.current} / {input.capacity} poäng nu</strong> · Lägst {forecast.lowest} med planerade aktiviteter kommande sju dagar.</p>
    <progress style={{accentColor: "var(--primary)", height: "0.5rem"}} aria-label="Matchutrymme nu" value={forecast.current} max={input.capacity} className="w-full" />
    <p>{spaceLabels[forecast.level]} · Uppskattad prognos</p>
    <p className="text-sm" style={{color: "var(--ink-secondary)"}}>Kapaciteten är tränarens bedömning för kallelser och utlåning. Alla börjar på 100 poäng. Återhämtning: 20 poäng per dygn utanför aktiviteter. Match: 0,5 poäng per spelminut. Träning: 15 poäng per uppskattad timme.</p>
    <p className="text-sm" style={{color: "var(--ink-secondary)"}}>Utespelarna delar lika: 6 × 60 minuter i 7 mot 7, 8 × 75 i 9 mot 9, delat på deltagarna utom målvakten. Målvakten får full matchtid. Träningar uppskattas till 60 minuter. Historiken omfattar 28 dagar och börjar med antaget fullt batteri. Cuper hanteras separat och ingår inte i batteriet. Andra idrotter och saknad närvaro ingår inte.</p>
    {canEdit && <form onSubmit={event => {
      event.preventDefault(); setMessage("");
      const form = new FormData(); form.set("capacity", String(capacity));
      startTransition(async () => { try { await saveMatchSpaceCapacity(playerId, form); setMessage("Kapaciteten är uppdaterad."); } catch (error) { setMessage(error instanceof Error ? error.message : "Det gick inte att spara."); } });
    }} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">Individuell kapacitet (poäng)
        <input type="number" min={50} max={150} step={1} required value={capacity} onChange={event => setCapacity(Number(event.target.value))} className="input" style={{maxWidth: "10rem"}} />
      </label>
      <button type="submit" className="btn-secondary btn-sm" disabled={pending}>{pending ? "Sparar…" : "Spara kapacitet"}</button>
      <span role="status">{message}</span>
    </form>}
  </section>;
}
