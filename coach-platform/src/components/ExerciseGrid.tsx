"use client";

import { useMemo, useState } from "react";
import type { Exercise } from "@/domain/model";

export function ExerciseGrid({ exercises, children }: { exercises: Exercise[]; children: (exercise: Exercise, index: number) => React.ReactNode }) {
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
      <div className="exercise-grid">{filtered.map((exercise, index) => children(exercise, index))}</div>
      {!filtered.length && <p className="editor-help">{`Inga övningar matchar "${q}".`}</p>}
    </>
  );
}