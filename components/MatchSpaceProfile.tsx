"use client";
import MatchSpaceBar from "./MatchSpaceBar";
import { useState, useTransition } from "react";
import { saveMatchSpaceCapacity } from "@/lib/matchSpaceActions";
import { forecastMatchSpace, type SpaceInput } from "@/lib/matchSpace";

export default function MatchSpaceProfile({ playerId, input, canEdit }: {playerId: number; input: SpaceInput; canEdit: boolean}) {
  const [capacity, setCapacity] = useState(input.capacity);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const forecast = forecastMatchSpace(input);
  return <section className="core-panel p-5 space-y-3">
    <h2 className="core-section-title">Matchutrymme</h2>
    {input.sourceWarning && <p className="text-sm" style={{color:"var(--warning)"}}>{input.sourceWarning}</p>}
    <MatchSpaceBar forecast={forecast}/>
    <p className="space-battery-legend"><i aria-hidden="true"/>Nu <i aria-hidden="true"/>Lägst kommande 7 dagar · uppskattning</p>
    <details className="text-sm"><summary className="cursor-pointer">Beräkning och individuell justering</summary>
    <p className="mt-3 mb-3" style={{color: "var(--ink-secondary)"}}>Fullt batteri visas alltid som 100 %. Justeringen anger kapacitet jämfört med standard (100 %). Ett större batteri förbrukar en mindre andel vid samma speltid. Utespelarna delar lika på speltiden, målvakten får full matchtid. Träningar uppskattas till 60 minuter. Historiken omfattar 28 dagar med antaget fullt batteri från början. Cuper, andra idrotter och saknad närvaro ingår inte.</p>
    {canEdit && <form onSubmit={event => {
      event.preventDefault(); setMessage("");
      const form = new FormData(); form.set("capacity", String(capacity));
      startTransition(async () => { try { await saveMatchSpaceCapacity(playerId, form); setMessage("Kapaciteten är uppdaterad."); } catch (error) { setMessage(error instanceof Error ? error.message : "Det gick inte att spara."); } });
    }} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">Kapacitetsjustering (% av standard)
        <input type="number" min={50} max={150} step={1} required value={capacity} onChange={event => setCapacity(Number(event.target.value))} className="input" style={{maxWidth: "10rem"}} />
      </label>
      <button type="submit" className="btn-secondary btn-sm" disabled={pending}>{pending ? "Sparar…" : "Spara kapacitet"}</button>
      <span role="status">{message}</span>
    </form>}
    </details>
  </section>;
}
