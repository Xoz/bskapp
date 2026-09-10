'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { saveMatchPlan } from '@/lib/matchPlan/actions';
import { emptyMatchPlan, IDEA_FIELDS, MATCH_FORMATIONS, type MatchPlan } from '@/lib/matchPlan/model';
import './match-plan.css';

type Player = { id: number; name: string; jersey_number: number | null };
const ROLE_LABELS = { gk: 'Målvakt', def: 'Back', mid: 'Mittfältare', fwd: 'Anfallare' };

function PlayerShirt({ number, goalkeeper = false, empty = false }: { number: number | string; goalkeeper?: boolean; empty?: boolean }) {
  return <svg className="match-plan-shirt" viewBox="0 0 80 84" aria-hidden="true" data-goalkeeper={goalkeeper} data-empty={empty}>
    <path className="shirt-body" d="M26 9 14 14 3 31 16 40 23 30 23 73Q40 79 57 73L57 30 64 40 77 31 66 14 54 9Q40 17 26 9Z"/>
    <path className="shirt-sleeve" d="M26 9 14 14 3 31 16 40 23 30Z M54 9 66 14 77 31 64 40 57 30Z"/>
    <path className="shirt-collar" d="M27 10Q40 25 53 10L48 8Q40 17 32 8Z"/>
    <path className="shirt-seam" d="M25 68Q40 72 55 68"/>
    <text x="40" y="54" textAnchor="middle">{empty ? '+' : number}</text>
  </svg>;
}
function shortName(name: string) {
  const parts = name.replace(/^Exempel:\s*/, '').split(' ');
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)![0]}.` : parts[0];
}

export default function MatchPlanEditor({ matchId, initialPlan, initialRevision, players, editable }: {
  matchId: number; initialPlan: MatchPlan; initialRevision: number; players: Player[]; editable: boolean;
}) {
  const [plan, setPlan] = useState(initialPlan);
  const [revision, setRevision] = useState(initialRevision);
  const [saved, setSaved] = useState(JSON.stringify(initialPlan));
  const [active, setActive] = useState(0);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const pitch = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ index: number; x: number; y: number } | null>(null);
  const dirty = JSON.stringify(plan) !== saved;
  const fm = MATCH_FORMATIONS.find(f => f.id === plan.formation)!;
  const byId = new Map(players.map(p => [p.id, p]));
  const placed = new Set(plan.spots.map(s => s.playerId));
  const reserves = players.filter(p => !placed.has(p.id));
  const missing = plan.spots.some(s => s.playerId !== null && !byId.has(s.playerId));

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function move(index: number, x: number, y: number) {
    setMessage('');
    setPlan(p => ({ ...p, spots: p.spots.map((s, i) => i === index
      ? { ...s, x: Math.max(.08, Math.min(.92, x)), y: Math.max(.08, Math.min(.92, y)) } : s) }));
  }
  function assign(id: number | null) {
    setMessage('');
    setPlan(p => ({ ...p, spots: p.spots.map((s, i) => ({ ...s,
      playerId: i === active ? id : s.playerId === id ? null : s.playerId,
    })) }));
  }
  function changeFormation(id: string) {
    setMessage('');
    setPlan(p => ({ ...p, formation: id, spots: emptyMatchPlan(id).spots.map((s, i) => ({ ...s, playerId: p.spots[i].playerId })) }));
  }
  function save() {
    setMessage('');
    startTransition(async () => {
      try {
        const result = await saveMatchPlan(matchId, revision, plan);
        if (result.error) setMessage(result.error);
        else if (result.revision) { setRevision(result.revision); setSaved(JSON.stringify(plan)); setMessage('Matchplanen är sparad.'); }
      } catch { setMessage('Kunde inte spara. Dina ändringar finns kvar här. Försök igen.'); }
    });
  }

  return <section className="core-panel match-plan" id="matchplan" aria-labelledby="match-plan-title">
    <header className="match-plan-heading">
      <div><p className="core-kicker">Inför avspark</p><h2 id="match-plan-title">Formation och spelidé</h2>
        <p className="body-small">Planera hur laget ska spela i den här matchen.</p></div>
      <span className="badge">7 mot 7</span>
    </header>
    <fieldset disabled={!editable || pending} className="match-plan-fields">
      <div className="match-plan-grid">
        <div>
          <label className="label" htmlFor="match-formation">Grundformation</label>
          <select id="match-formation" className="input" value={plan.formation} onChange={e => changeFormation(e.target.value)}>
            {MATCH_FORMATIONS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
          <p className="match-plan-help">{editable ? 'Välj en position och tilldela en spelare. Dra positionerna för att justera formen.' : 'Matchens planerade positioner.'}</p>
          <div className="match-plan-pitch" ref={pitch} aria-label="Fotbollsplan, anfallsriktning uppåt">
            <svg className="match-plan-lines" viewBox="0 0 100 130" preserveAspectRatio="none" aria-hidden="true">
              <rect x="3" y="3" width="94" height="124" rx="1"/><path d="M3 65H97"/><circle cx="50" cy="65" r="12"/>
              <rect x="25" y="3" width="50" height="20"/><rect x="25" y="107" width="50" height="20"/>
              <rect x="40" y="0" width="20" height="3"/><rect x="40" y="127" width="20" height="3"/>
            </svg>
            <span className="match-plan-direction">↑ Anfallsriktning</span>
            {plan.spots.map((s, i) => {
              const player = s.playerId === null ? null : byId.get(s.playerId);
              const role = ROLE_LABELS[fm.slots[i].role];
              const name = player?.name ?? (s.playerId ? 'Ej tillgänglig' : role);
              return <button type="button" key={i} className="match-plan-spot" data-active={active === i} data-goalkeeper={i === 0} data-empty={!player} title={name}
                style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%` }} aria-pressed={active === i}
                aria-label={`Position ${i + 1}: ${role}, ${player?.name ?? (s.playerId ? 'inte längre tillgänglig' : 'ledig')}`}
                onClick={() => setActive(i)}
                onPointerDown={e => { setActive(i); dragging.current = { index: i, x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); }}
                onPointerMove={e => {
                  const d = dragging.current;
                  if (!d || d.index !== i || Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return;
                  const box = pitch.current?.getBoundingClientRect();
                  if (box) move(i, (e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height);
                }}
                onPointerUp={() => { dragging.current = null; }} onPointerCancel={() => { dragging.current = null; }}
                onKeyDown={e => {
                  const delta: Record<string, [number, number]> = { ArrowLeft: [-.02, 0], ArrowRight: [.02, 0], ArrowUp: [0, -.02], ArrowDown: [0, .02] };
                  if (delta[e.key]) { e.preventDefault(); move(i, s.x + delta[e.key][0], s.y + delta[e.key][1]); }
                }}>
                <PlayerShirt number={player?.jersey_number ?? (i === 0 ? 'MV' : '•')} goalkeeper={i === 0} empty={!player}/>
                <span className="match-plan-name">{player ? shortName(player.name) : name}</span>
              </button>;
            })}
          </div>
          {editable && <div className="match-plan-assignment">
            <label className="label" htmlFor="position-player">Position {active + 1} · {ROLE_LABELS[fm.slots[active].role]}</label>
            <select id="position-player" className="input" value={plan.spots[active].playerId ?? ''} onChange={e => assign(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Ledig position</option>
              {plan.spots[active].playerId && !byId.has(plan.spots[active].playerId) && <option value={plan.spots[active].playerId!}>Inte längre tillgänglig – välj en annan spelare</option>}
              {players.map(p => <option value={p.id} key={p.id}>{p.name}{placed.has(p.id) && plan.spots[active].playerId !== p.id ? ' · flytta hit' : ''}</option>)}
            </select>
            <button type="button" className="btn-secondary btn-sm" onClick={() => changeFormation(plan.formation)}>Återställ positionernas form</button>
            <p className="match-plan-help">Du kan även flytta vald position med piltangenterna.</p>
          </div>}
          <div className="match-plan-reserves"><h3>Trupp · {players.length}</h3><p className="match-plan-help">Alla i truppen har tackat ja. {reserves.length} spelare återstår att placera.</p>
            {reserves.length > 0 ? <>
              {editable && <p className="match-plan-help">Tryck på en spelare för att placera henne på vald position.</p>}
              <div className="match-plan-bench">{reserves.map(p => <button type="button" key={p.id} className="match-plan-bench-player" onClick={() => assign(p.id)}>
                <PlayerShirt number={p.jersey_number ?? '•'}/><span>{p.name}</span>
              </button>)}</div>
            </> : <p className="body-small">{players.length ? 'Alla tillgängliga spelare är placerade.' : 'Inga spelare har tackat ja ännu. Du kan börja med formationen och spelidén.'}</p>}
          </div>
          {missing && <p role="alert">Truppen har ändrats. Byt ut spelare som är markerade ”Ej tillgänglig” innan du sparar.</p>}
        </div>
        <div className="match-plan-ideas">
          <h3>Så vill vi spela</h3>
          {IDEA_FIELDS.map(f => <label key={f.key} className="label">{f.label}
            <textarea className="input" rows={f.key === 'focus' ? 3 : 4} maxLength={2000} value={plan.ideas[f.key]} placeholder={f.placeholder}
              onChange={e => { setMessage(''); setPlan(p => ({ ...p, ideas: { ...p.ideas, [f.key]: e.target.value } })); }}/>
          </label>)}
        </div>
      </div>
    </fieldset>
    <footer className="match-plan-footer">
      {editable && <button type="button" className="btn-primary" disabled={pending || missing || (!dirty && revision > 0)} onClick={save}>{pending ? 'Sparar…' : 'Spara matchplan'}</button>}
      <p className="body-small" role="status">{message || (dirty ? 'Osparade ändringar' : revision ? 'Sparad matchplan' : 'Ingen matchplan sparad ännu')}</p>
    </footer>
  </section>;
}
