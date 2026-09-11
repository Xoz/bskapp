'use client';
import {useState,useTransition} from 'react';
import {DOUBLE_PAIRS,allowedDoublePairs,toggleDoublePair,type Evidence} from '@/lib/selection/rules';
import {saveSelectionPolicy} from '@/lib/selection/actions';
export default function SelectionPolicyForm({playerId,evidence}:{playerId:number;evidence:Evidence}) {
 const [revision,setRevision]=useState(evidence.revision),[message,setMessage]=useState(''),[pending,start]=useTransition();
 const p=evidence.policy;
 const [pairs,setPairs]=useState(()=>allowedDoublePairs(p.pairs));
 const past=evidence.matches.filter(m=>m.date<evidence.asOf&&m.reply==='declined');
 return <details className="core-panel core-form-panel" id="uttagningsregler">
  <summary className="cursor-pointer font-semibold">Uttagningsregler · två matcher och frånvaro</summary>
  <form className="mt-4 space-y-4" action={form=>start(async()=>{try{const r=await saveSelectionPolicy(playerId,form);setMessage(r.message);if(r.ok&&r.revision)setRevision(r.revision);}catch{setMessage('Kunde inte spara. Kontrollera din behörighet och försök igen.');}})}>
   <input type="hidden" name="revision" value={revision}/>
   <fieldset><legend className="font-semibold">Tillåtna kombinationer samma dag</legend>
    <p className="text-sm mt-1">Högst två matcher. Båda måste fungera tidsmässigt och batteriet måste vara minst 60 % för automatförslag. 40–59 % kräver ditt aktiva val. Ingen markering innebär tränarbedömning för alla dubbelmatcher.</p>
    <p className="text-sm mt-2">En godkänd kombination tillåter också lättare matcher. Svår + Svår tillåter alla kombinationer. Avmarkerar du en lättare kombination tas även svårare godkännanden som förutsätter den bort.</p>
    <div className="grid gap-2 sm:grid-cols-2 mt-3">{DOUBLE_PAIRS.map(pair=><label key={pair.key} className="flex items-center gap-2"><input type="checkbox" name="pair" value={pair.key} checked={pairs.includes(pair.key)} onChange={e=>{setPairs(current=>toggleDoublePair(current,pair.key,e.target.checked));setMessage('');}}/>{pair.label}</label>)}</div>
    <button type="button" className="text-sm underline mt-2" onClick={()=>{setPairs([]);setMessage('');}}>Rensa kombinationer</button>
   </fieldset>
   <fieldset><legend className="font-semibold">Känd otillgänglighet</legend><p className="text-sm">Inga automatförslag under perioden. Frånvaro och nej-svar under perioden sänker inte prioriteten. Töm båda datumen för att ta bort perioden.</p>
    <div className="flex flex-wrap gap-3 mt-2"><label>Från<input className="input block" type="date" name="unavailable_from" defaultValue={p.unavailableFrom}/></label><label>Till<input className="input block" type="date" name="unavailable_to" defaultValue={p.unavailableTo}/></label></div>
   </fieldset>
   <fieldset><legend className="font-semibold">Giltig träningsfrånvaro</legend><p className="text-sm">Markera undantag. Faktisk närvaro ändras inte. Okänd närvaro räknas aldrig som frånvaro.</p>
    {evidence.training.map(t=><label key={t.id} className="flex gap-2 items-center mt-2"><input name="excused_training" type="checkbox" value={t.id} defaultChecked={p.excusedTraining.includes(t.id)}/>{t.date} · {t.status==='present'?'Deltog':t.status==='absent'?'Frånvaro':'Okänd närvaro'}</label>)}
    {p.excusedTraining.filter(id=>!evidence.training.some(t=>t.id===id)).map(id=><input key={id} type="hidden" name="excused_training" value={id}/>)}
   </fieldset>
   <fieldset><legend className="font-semibold">Undanta erbjuden match</legend><p className="text-sm">Nej-svar senaste fyra veckorna. Undanta exempelvis överenskommen vila; svaret i Svenska Lag ändras inte.</p>
    {past.length?past.map(m=><label key={m.id} className="flex gap-2 items-center mt-2"><input name="excused_match" type="checkbox" value={m.id} defaultChecked={p.excusedMatches.includes(m.id)}/>{m.date} {m.time} · <a className="underline" href={`/matcher/${m.id}`}>Visa match</a></label>):<p className="text-sm mt-2">Inga nej-svar under perioden.</p>}
    {p.excusedMatches.filter(id=>!past.some(m=>m.id===id)).map(id=><input key={id} type="hidden" name="excused_match" value={id}/>)}
   </fieldset>
   <p role="status">{message}</p><button className="btn-primary" type="submit" disabled={pending}>{pending?'Sparar…':'Spara uttagningsregler'}</button>
  </form>
 </details>;
}
