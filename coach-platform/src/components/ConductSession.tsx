"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DiagramView } from "./diagram/DiagramView";
import { saveConductAction } from "@/app/actions";
import type { AttendanceStatus, BlockConductStatus, BlockDifficulty } from "@/repositories/postgres";
import type { Diagram } from "@/domain/diagram";

type Block = { id: string; exerciseId: string; title: string; minutes: number; coachingPoints: string[]; coach: string | null; area: string | null; equipment: string[]; groupName: string | null };
type Session = { id: string; title: string; blocks: Block[] };

type BlockState = { status: "pending" | BlockConductStatus; note: string; difficulty: "" | BlockDifficulty; replacedExerciseId: string; extraSeconds: number };

const ATT_CYCLE: AttendanceStatus[] = ["present", "late", "partial", "absent", "trial"];
const ATT_LABEL: Record<AttendanceStatus, string> = { present: "Närvarande", late: "Sent", partial: "Delvis", absent: "Frånvarande", trial: "Provpass" };
const ATT_COLOR: Record<AttendanceStatus, string> = { present: "var(--green)", late: "var(--amber)", partial: "var(--blue)", absent: "#b33b35", trial: "#8a6dbf" };
const DIFF_LABEL: Record<BlockDifficulty, string> = { too_easy: "För lätt", ok: "Lagom", too_hard: "För svår" };

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const metaRow = (b: Block) => [b.groupName && `Grupp: ${b.groupName}`, b.coach && `Tränare: ${b.coach}`, b.area && `Yta: ${b.area}`, b.equipment.length && `Material: ${b.equipment.join(", ")}`].filter(Boolean).join(" · ");

export function ConductSession({ session, exercises, players, attendance, diagrams }: {
  session: Session;
  exercises: { id: string; name: string }[];
  players: { id: string; name: string; number?: number }[];
  attendance: { playerId: string; status: AttendanceStatus }[];
  diagrams: Record<string, Diagram>;
}) {
  const blocks = session.blocks;
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(blocks[0].minutes * 60);
  const [paused, setPaused] = useState(false);
  const [phase, setPhase] = useState<"running" | "reflection">("running");
  const [perBlock, setPerBlock] = useState<Record<string, BlockState>>(() => Object.fromEntries(blocks.map(b => [b.id, { status: "pending", note: "", difficulty: "", replacedExerciseId: "", extraSeconds: 0 }])));
  const [att, setAtt] = useState<Record<string, AttendanceStatus>>(() => Object.fromEntries(players.map(p => [p.id, (attendance.find(a => a.playerId === p.id)?.status ?? "present")])));
  const [noteOpen, setNoteOpen] = useState<string | null>(null);
  const [showAtt, setShowAtt] = useState(false);

  // ponytail: timer + per-block-state är lokalt — refresh mittpass återställer timern.
  useEffect(() => {
    if (phase !== "running" || paused) return;
    const id = setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [phase, paused]);

  const current = blocks[index];
  const state = perBlock[current.id];
  const diagram = diagrams[state?.replacedExerciseId || current.exerciseId] ?? diagrams[current.exerciseId];

  const goto = (i: number) => { setIndex(i); setSecondsLeft(blocks[i].minutes * 60); setPaused(false); setNoteOpen(null); };
  const patch = (id: string, fn: (s: BlockState) => BlockState) => setPerBlock(prev => ({ ...prev, [id]: fn(prev[id]) }));
  const complete = (id: string) => patch(id, s => ({ ...s, status: "completed" }));
  const actualMinutesOf = (b: Block) => { const s = perBlock[b.id]; if (s.status === "skipped") return 0; return b.minutes + Math.round((s.extraSeconds ?? 0) / 60); };

  const next = () => { if (state.status === "pending") complete(current.id); if (index < blocks.length - 1) goto(index + 1); else setPhase("reflection"); };
  const prev = () => { if (index > 0) goto(index - 1); };
  const skip = () => { patch(current.id, s => ({ ...s, status: "skipped" })); if (index < blocks.length - 1) goto(index + 1); else setPhase("reflection"); };
  const add2 = () => { patch(current.id, s => ({ ...s, extraSeconds: s.extraSeconds + 120 })); setSecondsLeft(s => s + 120); };
  const cycleAtt = (pid: string) => setAtt(prev => { const i = ATT_CYCLE.indexOf(prev[pid]); return { ...prev, [pid]: ATT_CYCLE[(i + 1) % ATT_CYCLE.length] }; });

  const done = blocks.filter(b => perBlock[b.id].status === "completed").length;
  const skipped = blocks.filter(b => perBlock[b.id].status === "skipped").length;
  const attCount = Object.values(att).filter(s => s === "present").length;

  if (phase === "reflection") {
    return <div className="page conduct">
      <div className="conduct-header"><Link className="button" href={`/traningspass/${session.id}`}>← Avbryt</Link><h1>Genomfört — {session.title}</h1></div>
      <form action={saveConductAction} className="stack">
        <input name="sessionId" type="hidden" value={session.id}/>
        {blocks.map(b => <div key={b.id}>
          <input name="blockId" type="hidden" value={b.id}/>
          <input name={`status_${b.id}`} type="hidden" value={perBlock[b.id].status === "skipped" ? "skipped" : "completed"}/>
          <input name={`actualMinutes_${b.id}`} type="hidden" value={String(actualMinutesOf(b))}/>
          <input name={`note_${b.id}`} type="hidden" value={perBlock[b.id].note}/>
          <input name={`difficulty_${b.id}`} type="hidden" value={perBlock[b.id].difficulty}/>
          <input name={`replaced_${b.id}`} type="hidden" value={perBlock[b.id].replacedExerciseId}/>
        </div>)}
        {players.map(p => <input key={p.id} name={`att_${p.id}`} type="hidden" value={att[p.id] ?? "present"} />)}
        <div className="card"><h2>Hur fungerade passet?</h2><textarea name="overallNote" rows={3} placeholder="Sammanfattning av passet…" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--line)" }}/></div>
        <div className="card"><h2>Var nivån lagom?</h2><textarea name="levelFeedback" rows={2} placeholder="För lätt/lagom/för svårt — helhet eller per moment…" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--line)" }}/></div>
        <div className="card"><h2>Vad följas upp nästa gång?</h2><textarea name="followup" rows={2} placeholder="Spelare som behöver extra stöd, moment att repetera…" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--line)" }}/></div>
        <div className="card"><h2>Sammanställning</h2><p className="editor-help">{done} genomförda · {skipped} hoppade över · {attCount}/{players.length} närvarande</p>
          <ul className="check-list">
            {blocks.map(b => <li key={b.id}><b>{perBlock[b.id].status === "skipped" ? "⏭ " : "✓ "}{b.title}</b> <span style={{ color: "var(--muted)" }}>— {perBlock[b.id].status === "skipped" ? "hoppades över" : `${actualMinutesOf(b)} min`}{perBlock[b.id].difficulty ? ` · ${DIFF_LABEL[perBlock[b.id].difficulty as BlockDifficulty]}` : ""}</span></li>)}
          </ul>
        </div>
        <button className="button primary conduct-save" type="submit">Spara genomfört pass</button>
      </form>
    </div>;
  }

  const meta = metaRow(current);
  return <div className="page conduct">
    <div className="conduct-header">
      <Link className="button" href={`/traningspass/${session.id}`}>← Avsluta</Link>
      <h1>{session.title}</h1>
      <button className="button primary" onClick={() => setPhase("reflection")}>Avsluta pass →</button>
    </div>
    <div className="conduct-progress">
      <span>Block {index + 1}/{blocks.length} · {done} klara · {skipped} hoppade</span>
      <div className="progress"><i style={{ width: `${(index / blocks.length) * 100}%` }}/></div>
    </div>

    <div className="conduct-stage">
      <div className="conduct-timer" data-paused={paused || secondsLeft === 0}>{fmt(secondsLeft)}</div>
      <h2 className="conduct-title">{state.replacedExerciseId ? exercises.find(e => e.id === state.replacedExerciseId)?.name ?? current.title : current.title}</h2>
      {meta ? <p className="conduct-meta">{meta}</p> : null}
      <div className="conduct-pitch"><DiagramView diagram={diagram}/></div>
      {current.coachingPoints.length ? <ul className="conduct-points">{current.coachingPoints.map((p, i) => <li key={i}>{p}</li>)}</ul> : null}
      {state.status !== "pending" ? <div className="conduct-state">{state.status === "skipped" ? "⏭ Hoppad över" : "✓ Genomförd"}{state.difficulty ? ` · ${DIFF_LABEL[state.difficulty as BlockDifficulty]}` : ""}</div> : null}
      {noteOpen === current.id ? <textarea placeholder="Anteckning för detta block…" value={state.note} onChange={e => patch(current.id, s => ({ ...s, note: e.target.value }))} rows={2} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--line)" }}/> : null}
    </div>

    <div className="conduct-actions">
      <button className="conduct-btn" onClick={() => setPaused(p => !p)}>{paused ? "▶ Fortsätt" : "⏸ Paus"}</button>
      <button className="conduct-btn" onClick={add2}>+ 2 min</button>
      <button className="conduct-btn" onClick={prev} disabled={index === 0}>◀ Föregående</button>
      <button className="conduct-btn primary" onClick={next}>{index < blocks.length - 1 ? "Nästa ▶" : "Klar ▶"}</button>
      <button className="conduct-btn" onClick={() => complete(current.id)}>✓ Genomförd</button>
      <button className="conduct-btn" onClick={skip}>⏭ Hoppa över</button>
      <button className="conduct-btn" onClick={() => setNoteOpen(noteOpen === current.id ? null : current.id)}>📝 Anteckning</button>
    </div>

    <div className="conduct-row">
      <div className="card">
        <h2>Svårighet</h2>
        <div className="conduct-actions">
          {(["too_easy", "ok", "too_hard"] as BlockDifficulty[]).map(d => <button key={d} className={`conduct-btn ${state.difficulty === d ? "active" : ""}`} onClick={() => patch(current.id, s => ({ ...s, difficulty: s.difficulty === d ? "" : d }))}>{DIFF_LABEL[d]}</button>)}
        </div>
      </div>
      <div className="card">
        <h2>Byt övning</h2>
        <select value={state.replacedExerciseId} onChange={e => patch(current.id, s => ({ ...s, replacedExerciseId: e.target.value }))} style={{ width: "100%", padding: "12px 10px", borderRadius: 8, border: "1px solid var(--line)" }}>
          <option value="">Planerad: {current.title}</option>
          {exercises.filter(e => e.id !== current.exerciseId).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>
    </div>

    <div className="card">
      <button className="button" onClick={() => setShowAtt(s => !s)}>{showAtt ? "Dölj" : "Visa"} närvaro · {attCount}/{players.length} närvarande</button>
      {showAtt ? <div className="conduct-att">{players.map(p => <button key={p.id} type="button" className="conduct-att-row" style={{ borderLeftColor: ATT_COLOR[att[p.id]] }} onClick={() => cycleAtt(p.id)}><span>{p.number ? `#${p.number} ` : ""}{p.name}</span><b style={{ color: ATT_COLOR[att[p.id]] }}>{ATT_LABEL[att[p.id]]}</b></button>)}</div> : null}
    </div>
  </div>;
}
