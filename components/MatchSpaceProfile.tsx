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
  return <section className="core-panel core-form-panel profile-battery">
    <div className="profile-section-heading"><h2 className="core-section-title">Matchutrymme</h2><span className="profile-meta">Beräknat · kommande 7 dagar</span></div>
    <MatchSpaceBar forecast={forecast}/>
    <div className="profile-battery-tools"><details className="profile-details"><summary>Så beräknas det</summary>
    <p className="mt-3 mb-3" style={{color: "var(--ink-secondary)"}}>Fullt batteri visas alltid som 100 %. Justeringen anger kapacitet jämfört med standard (100 %). Ett större batteri förbrukar en mindre andel vid samma speltid. Utespelarna delar lika på speltiden, målvakten får full matchtid. Träningar uppskattas till 60 minuter. Historiken omfattar 28 dagar med antaget fullt batteri från början. Cuper, andra idrotter och saknad närvaro ingår inte.</p>
    </details>
    {canEdit && <details className="profile-details"><summary>Justera kapacitet</summary><form onSubmit={event => {
      event.preventDefault(); setMessage("");
      const form = new FormData(); form.set("capacity", String(capacity));
      startTransition(async () => { try { await saveMatchSpaceCapacity(playerId, form); setMessage("Kapaciteten är uppdaterad."); } catch (error) { setMessage(error instanceof Error ? error.message : "Det gick inte att spara."); } });
    }} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">Kapacitetsjustering (% av standard)
        <input type="number" min={50} max={150} step={1} required value={capacity} onChange={event => setCapacity(Number(event.target.value))} className="input" style={{maxWidth: "10rem"}} />
      </label>
      <button type="submit" className="btn-secondary btn-sm" disabled={pending}>{pending ? "Sparar…" : "Spara kapacitet"}</button>
      <span role="status">{message}</span>
    </form></details>}
    </div>
  </section>;
}
