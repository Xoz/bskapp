"use client";

import { useState, useTransition } from "react";
import {
  CATEGORIES,
  skillsByCategory,
  allCategoryProgress,
  filterSkills,
  isUnlocked,
  nextRecommendedSkill,
  skill as skillById,
  statusOf,
  totalProgress,
  STATUS_COLOR,
  STATUS_LABEL,
  type CategoryId,
  type FilterMode,
  type SkillStatus,
  type StatusMap,
} from "@/lib/skillTrappan";
import { setSkillStatus, setSkillNote } from "@/lib/actions";

const FILTERS: { mode: FilterMode; label: string }[] = [
  { mode: "next", label: "Aktuellt" },
  { mode: "all", label: "Hela trädet" },
  { mode: "level1", label: "Nivå 1" },
  { mode: "level2", label: "Nivå 2" },
  { mode: "level3", label: "Nivå 3" },
  { mode: "level4", label: "Nivå 4" },
  { mode: "level5", label: "Nivå 5" },
];

const STATUS_SEQUENCE: SkillStatus[] = ["not_started", "training", "almost", "done"];

export default function UtvecklingChecklist({
  playerId,
  firstName,
  initialStatuses,
  initialNote = "",
  focusSkillIds = [],
  readOnly = false,
}: {
  playerId: number;
  firstName: string;
  initialStatuses: StatusMap;
  initialNote?: string;
  focusSkillIds?: string[];
  readOnly?: boolean;
}) {
  const [statuses, setStatuses] = useState(initialStatuses);
  const [note, setNote] = useState(initialNote);
  const [filterMode, setFilterMode] = useState<FilterMode>("next");
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | "all">("all");
  const [, startTransition] = useTransition();

  function updateStatus(skillId: string, status: SkillStatus) {
    setStatuses((prev) => ({ ...prev, [skillId]: status }));
    startTransition(() => {
      setSkillStatus(playerId, skillId, status);
    });
  }

  function commitNote() {
    startTransition(() => {
      setSkillNote(playerId, note);
    });
  }

  const total = totalProgress(statuses);
  const next = nextRecommendedSkill(statuses);
  const catProgress = allCategoryProgress(statuses);
  const hasAssessment = Object.keys(statuses).length > 0;
  const focusSkills = focusSkillIds
    .map((id) => skillById(id))
    .filter((skill): skill is NonNullable<typeof skill> => Boolean(skill));
  const categoriesToShow = categoryFilter === "all" ? CATEGORIES : CATEGORIES.filter((c) => c.id === categoryFilter);

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="eyebrow mb-2">Färdighetsresan</p>
          {hasAssessment ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="stat-number text-2xl">{total.done}</span>
                <span className="caption" style={{ color: "var(--ink-muted)" }}>
                  av {total.total} steg behärskade
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "var(--elevated)" }}>
                <div className="h-full rounded-full" style={{ width: `${total.percent}%`, background: "var(--primary)" }} />
              </div>
            </>
          ) : (
            <p className="body-small" style={{ color: "var(--ink-secondary)" }}>
              Ingen avstämning ännu. Börja med att beskriva nuläget, inte med en procentsiffra.
            </p>
          )}
        </div>
        <div className="card p-5">
          <p className="eyebrow mb-2">Nästa rekommenderade färdighet</p>
          {next ? (
            <>
              <p className="font-medium text-sm mb-0.5">{next.title}</p>
              <p className="caption" style={{ color: "var(--ink-secondary)" }}>{next.question}</p>
            </>
          ) : (
            <p className="body-small" style={{ color: "var(--ink-secondary)" }}>Allt klart – grymt jobbat! 🎉</p>
          )}
        </div>
      </div>

      {focusSkills.length > 0 && (
        <div>
          <p className="eyebrow mb-2">Valda fokus just nu</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {focusSkills.map((skill) => {
              const cat = CATEGORIES.find((item) => item.id === skill.category)!;
              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => setCategoryFilter(skill.category)}
                  className="card p-3 text-left"
                >
                  <span className="caption" style={{ color: cat.color }}>{cat.icon} {cat.name}</span>
                  <span className="block font-medium text-sm mt-1">{skill.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {catProgress.map((p) => {
          const cat = CATEGORIES.find((c) => c.id === p.category)!;
          const active = categoryFilter === p.category;
          return (
            <button
              key={p.category}
              type="button"
              onClick={() => setCategoryFilter(active ? "all" : p.category)}
              className="text-left rounded-lg p-2.5 transition"
              style={{
                border: `1px solid ${active ? cat.color : "var(--border)"}`,
                background: active ? `color-mix(in srgb, ${cat.color}, transparent 90%)` : "var(--surface)",
              }}
            >
              <div className="flex items-center gap-1.5 text-xs mb-1.5">
                <span>{cat.icon}</span>
                <span className="truncate">{cat.short}</span>
              </div>
              <span className="level-meter">
                {[1, 2, 3, 4, 5].map((n) => (
                  <i key={n} className={n <= p.currentLevel ? "on" : ""} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.mode}
            type="button"
            onClick={() => setFilterMode(f.mode)}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition"
            style={
              filterMode === f.mode
                ? { background: "var(--primary-soft)", color: "var(--primary)", border: "1px solid var(--primary-line)" }
                : { color: "var(--ink-muted)", border: "1px solid var(--border)" }
            }
          >
            {f.label}
          </button>
        ))}
        {categoryFilter !== "all" && (
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className="px-3 py-1.5 rounded-full text-xs"
            style={{ color: "var(--ink-muted)", border: "1px solid var(--border)" }}
          >
            Visa alla kategorier ×
          </button>
        )}
      </div>

      <div className="space-y-6">
        {categoriesToShow.map((cat) => {
          const skills = filterSkills(skillsByCategory(cat.id), statuses, filterMode);
          if (skills.length === 0) return null;
          return (
            <section key={cat.id}>
              <h2 className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ fontFamily: "var(--font-display)" }}>
                <span>{cat.icon}</span>
                {cat.name}
              </h2>
              <div className="space-y-1.5">
                {skills.map((s) => {
                  const st = statusOf(statuses, s.id);
                  const unlocked = isUnlocked(s, statuses);
                  return (
                    <div key={s.id} className="card p-3" style={{ opacity: unlocked ? 1 : 0.5 }}>
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <div className="min-w-0 flex items-center gap-2 flex-wrap">
                          <span className="caption tabular-nums" style={{ color: "var(--ink-muted)" }}>
                            Nivå {s.level}
                          </span>
                          <span className="font-medium text-sm">{s.question}</span>
                        </div>
                        <div className="inline-flex gap-1 shrink-0">
                          {STATUS_SEQUENCE.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              disabled={readOnly || !unlocked}
                              title={STATUS_LABEL[opt]}
                              onClick={() => updateStatus(s.id, opt)}
                              aria-label={`${s.title}: ${STATUS_LABEL[opt]}`}
                              aria-pressed={st === opt}
                              className="rounded-full border px-2 py-1 transition disabled:opacity-30 disabled:cursor-not-allowed"
                              style={{
                                background: st === opt ? STATUS_COLOR[opt] : "transparent",
                                borderColor: STATUS_COLOR[opt],
                                color: st === opt ? "#111" : "var(--ink-muted)",
                                fontSize: "0.65rem",
                              }}
                            >
                              {opt === "not_started" ? "Inte än" : opt === "training" ? "Övar" : opt === "almost" ? "Nära" : "Klar"}
                            </button>
                          ))}
                        </div>
                      </div>

                      {!unlocked ? (
                        <p className="caption" style={{ color: "var(--ink-muted)" }}>
                          🔒 Lås upp genom att klara föregående steg.
                        </p>
                      ) : (
                        <>
                          <p className="caption mb-1" style={{ color: "var(--ink-secondary)" }}>
                            <span style={{ color: "var(--ink-muted)" }}>Klart när: </span>
                            {s.criterion}
                          </p>
                          {st !== "done" ? (
                            <p className="caption" style={{ color: "var(--ink-secondary)" }}>
                              <span style={{ color: "var(--ink-muted)" }}>Träningsråd: </span>
                              {s.advice}
                            </p>
                          ) : (
                            <p className="caption" style={{ color: "#1fba8a" }}>
                              {s.nextStep}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {!readOnly && (
        <div className="card p-5">
          <label className="label mb-2" htmlFor="skill_note">
            Tränaranteckningar
          </label>
          <textarea
            id="skill_note"
            className="input"
            rows={3}
            placeholder={`Skriv en anteckning om ${firstName}s utveckling...`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={commitNote}
          />
        </div>
      )}
    </div>
  );
}
