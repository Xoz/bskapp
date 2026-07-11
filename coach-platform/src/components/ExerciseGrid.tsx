"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui";
import { ExerciseForm } from "@/components/ExerciseForm";
import { removeExercise } from "@/app/actions";
import type { Exercise } from "@/domain/model";

// ponytail: kortrenderingen bock i komponenten (inte som render-prop) — funktioner
// kan inte korsa RSC-gränsen server→klient.
export function ExerciseGrid({ exercises }: { exercises: Exercise[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return exercises;
    return exercises.filter((e) => (e.name + " " + e.summary).toLowerCase().includes(term));
  }, [q, exercises]);
  return (
    <>
      <div className="filters" style={{ gridTemplateColumns: "1fr" }}>
        <input aria-label="Sök övning" placeholder="Sök namn eller tema…" value={q} onChange={(e) => setQ(e.target.value)}/>
      </div>
      <div className="exercise-grid">{filtered.map((exercise, index) => <article className="exercise-card" key={exercise.id}><div className={`pitch pitch-${index % 3}`}><span>↗</span><i/><i/><i/></div><div><div className="badge-row"><Badge tone={index % 3 === 0 ? "blue" : "green"}>7v7</Badge><small>{exercise.durationMinutes} min</small></div><h2>{exercise.name}</h2><p>{exercise.summary}</p><footer><span>{exercise.players[0]}–{exercise.players[1]} spelare</span><Link href={`/ovningar/${exercise.id}/ritare`} className="button" style={{ padding: "6px 12px" }}>Rita</Link></footer><details><summary>Redigera</summary><ExerciseForm exercise={exercise}/><form action={removeExercise}><input name="id" type="hidden" value={exercise.id}/><button className="delete-button">Ta bort</button></form></details></div></article>)}</div>
      {!filtered.length && <p className="editor-help">{`Inga övningar matchar "${q}".`}</p>}
    </>
  );
}