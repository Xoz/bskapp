"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { createDevelopmentCheckpoint } from "@/lib/actions";
import {
  CATEGORIES,
  skillsByCategory,
  STATUS_COLOR,
  STATUS_LABEL,
  STATUS_ORDER,
  type SkillStatus,
  type StatusMap,
} from "@/lib/skillTrappan";

function SubmitButton({ changedCount }: { changedCount: number }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary px-6" disabled={pending}>
      {pending ? "Sparar avstämning…" : `Spara avstämning${changedCount ? ` · ${changedCount} ändringar` : ""}`}
    </button>
  );
}

export default function DevelopmentCheckinForm({
  playerId,
  firstName,
  today,
  initialStatuses,
  initialFocusIds = [],
  initialStrengths = "",
  initialFocusNote = "",
  initialWellbeingNote = "",
}: {
  playerId: number;
  firstName: string;
  today: string;
  initialStatuses: StatusMap;
  initialFocusIds?: string[];
  initialStrengths?: string;
  initialFocusNote?: string;
  initialWellbeingNote?: string;
}) {
  const normalizedInitial = useMemo<StatusMap>(() => {
    const result: StatusMap = {};
    for (const cat of CATEGORIES) {
      for (const skill of skillsByCategory(cat.id)) {
        result[skill.id] = initialStatuses[skill.id] ?? "not_started";
      }
    }
    return result;
  }, [initialStatuses]);
  const [statuses, setStatuses] = useState<StatusMap>(normalizedInitial);
  const [focusIds, setFocusIds] = useState<string[]>(initialFocusIds.slice(0, 2));

  const changedCount = Object.keys(statuses).filter((id) => statuses[id] !== normalizedInitial[id]).length;
  const activeCount = Object.values(statuses).filter((status) => status === "training" || status === "almost").length;

  function toggleFocus(skillId: string) {
    setFocusIds((current) => {
      if (current.includes(skillId)) return current.filter((id) => id !== skillId);
      if (current.length >= 2) return current;
      return [...current, skillId];
    });
  }

  return (
    <form action={createDevelopmentCheckpoint} className="space-y-6">
      <input type="hidden" name="player_id" value={playerId} />

      <div className="card p-6 space-y-5">
        <div>
          <p className="eyebrow mb-1">1 · Ramar för avstämningen</p>
          <h2 className="font-semibold">När och vem?</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="date">Datum</label>
            <input id="date" name="date" type="date" defaultValue={today} required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="coach_name">Tränare</label>
            <input id="coach_name" name="coach_name" className="input" placeholder="Hämtas från din profil" />
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="eyebrow mb-1">2 · Observerade färdigheter</p>
            <h2 className="font-semibold">Vad har förändrats?</h2>
            <p className="body-small mt-1" style={{ color: "var(--ink-secondary)" }}>
              Bekräfta nuläget eller ändra bara det du faktiskt har observerat. Kategorierna är hopfällda för att hålla avstämningen fokuserad.
            </p>
          </div>
          <div className="flex gap-2">
            <span className="badge badge-neutral">{activeCount} aktiva steg</span>
            <span className="badge badge-primary">{changedCount} ändrade</span>
          </div>
        </div>

        <div className="space-y-2">
          {CATEGORIES.map((cat) => {
            const skills = skillsByCategory(cat.id);
            const activeInCategory = skills.filter((skill) => {
              const status = statuses[skill.id];
              return status === "training" || status === "almost";
            }).length;
            return (
              <details key={cat.id} className="rounded-xl" style={{ border: "1px solid var(--border)", background: "var(--surface)" }} open={activeInCategory > 0 || undefined}>
                <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3">
                  <span className="font-medium text-sm">{cat.icon} {cat.name}</span>
                  <span className="caption" style={{ color: activeInCategory ? cat.color : "var(--ink-muted)" }}>
                    {activeInCategory ? `${activeInCategory} pågår` : `${skills.length} steg`} · öppna
                  </span>
                </summary>
                <div className="px-4 pb-4 space-y-3">
                  {skills.map((skill) => {
                    const status = statuses[skill.id];
                    const focused = focusIds.includes(skill.id);
                    const focusDisabled = !focused && focusIds.length >= 2;
                    return (
                      <div key={skill.id} className="rounded-lg p-3" style={{ background: "var(--elevated)", border: focused ? `1px solid ${cat.color}` : "1px solid transparent" }}>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <p className="caption" style={{ color: "var(--ink-muted)" }}>Nivå {skill.level}</p>
                            <p className="font-medium text-sm">{skill.title}</p>
                            <p className="caption mt-0.5" style={{ color: "var(--ink-secondary)" }}>{skill.criterion}</p>
                          </div>
                          <label className="caption flex items-center gap-1.5 shrink-0" style={{ color: focused ? cat.color : "var(--ink-muted)" }}>
                            <input
                              type="checkbox"
                              name="focus_skill"
                              value={skill.id}
                              checked={focused}
                              disabled={focusDisabled}
                              onChange={() => toggleFocus(skill.id)}
                            />
                            Fokus
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {STATUS_ORDER.map((option) => (
                            <label key={option} className="cursor-pointer">
                              <input
                                type="radio"
                                className="sr-only"
                                name={`skill_${skill.id}`}
                                value={option}
                                checked={status === option}
                                onChange={() => setStatuses((current) => ({ ...current, [skill.id]: option as SkillStatus }))}
                              />
                              <span
                                className="inline-flex rounded-full border px-2.5 py-1 caption font-medium transition"
                                style={{
                                  borderColor: STATUS_COLOR[option],
                                  background: status === option ? STATUS_COLOR[option] : "transparent",
                                  color: status === option ? "#111" : "var(--ink-muted)",
                                }}
                              >
                                {STATUS_LABEL[option]}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>
      </div>

      <div className="card p-6 space-y-5">
        <div>
          <p className="eyebrow mb-1">3 · Sammanfattning</p>
          <h2 className="font-semibold">Styrkor, fokus och mående</h2>
          <p className="body-small mt-1" style={{ color: "var(--ink-secondary)" }}>
            Färdigheter och mående hålls isär. Glädje och lagkänsla räknas aldrig som en färdighet som ska bli “klar”.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="strengths">Styrkor just nu</label>
          <textarea id="strengths" name="strengths" rows={3} className="input" defaultValue={initialStrengths} placeholder={`Vad gör ${firstName} bra just nu?`} />
        </div>
        <div>
          <label className="label" htmlFor="focus_note">Nästa fokus</label>
          <textarea id="focus_note" name="focus_note" rows={3} className="input" defaultValue={initialFocusNote} placeholder="Hur tränar vi konkret på de valda fokusfärdigheterna?" />
          <p className="caption mt-1.5" style={{ color: focusIds.length ? "var(--ink-muted)" : "var(--danger)" }}>
            {focusIds.length}/2 fokusfärdigheter valda i trädet ovan.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="wellbeing_note">Mående och spelarens upplevelse</label>
          <textarea id="wellbeing_note" name="wellbeing_note" rows={3} className="input" defaultValue={initialWellbeingNote} placeholder="Glädje, trygghet, motivation eller något spelaren själv har lyft…" />
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <SubmitButton changedCount={changedCount} />
        <span className="caption" style={{ color: "var(--ink-muted)" }}>
          Avstämningen sparas som en historisk ögonblicksbild och uppdaterar det aktuella trädet.
        </span>
      </div>
    </form>
  );
}
