"use client";

import { useState } from "react";
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
  type StatusMap,
} from "@/lib/skillTrappan";

const FILTERS: { mode: FilterMode; label: string }[] = [
  { mode: "next", label: "Aktuellt" },
  { mode: "all", label: "Hela trädet" },
  { mode: "level1", label: "Nivå 1" },
  { mode: "level2", label: "Nivå 2" },
  { mode: "level3", label: "Nivå 3" },
  { mode: "level4", label: "Nivå 4" },
  { mode: "level5", label: "Nivå 5" },
];

export default function UtvecklingChecklist({
  initialStatuses,
  initialNote = "",
  focusSkillIds = [],
}: {
  initialStatuses: StatusMap;
  initialNote?: string;
  focusSkillIds?: string[];
}) {
  const statuses = initialStatuses;
  const [filterMode, setFilterMode] = useState<FilterMode>("next");
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | "all">("all");

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
        <div className="core-panel p-5">
          <p className="core-kicker mb-2">Utvecklingsbild</p>
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
              Utvecklingsträdet är inte påbörjat. Börja med att beskriva nuläget, inte med en procentsiffra.
            </p>
          )}
        </div>
        <div className="core-panel p-5">
          <p className="core-kicker mb-2">Nästa möjliga steg</p>
          {next ? (
            <>
              <p className="font-medium text-sm mb-0.5">{next.title}</p>
              <p className="caption" style={{ color: "var(--ink-secondary)" }}>{next.question}</p>
            </>
          ) : (
            <p className="body-small" style={{ color: "var(--ink-secondary)" }}>
              Alla steg i trädet är markerade som klara.
            </p>
          )}
        </div>
      </div>

      {focusSkills.length > 0 && (
        <div>
          <p className="core-kicker mb-2">Valda fokus just nu</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {focusSkills.map((skill) => {
              const cat = CATEGORIES.find((item) => item.id === skill.category)!;
              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => setCategoryFilter(skill.category)}
                  className="core-panel p-3 text-left"
                >
                  <span className="caption" style={{ color: "var(--ink-muted)" }}>{cat.name}</span>
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
                border: `1px solid ${active ? "var(--primary-line)" : "var(--border)"}`,
                background: active ? "var(--primary-wash)" : "var(--surface)",
              }}
            >
              <div className="text-xs mb-1.5 truncate">{cat.short}</div>
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
            Rensa områdesfilter
          </button>
        )}
      </div>

      <div className="space-y-6">
        {categoriesToShow.map((cat) => {
          const skills = filterSkills(skillsByCategory(cat.id), statuses, filterMode);
          if (skills.length === 0) return null;
          return (
            <section key={cat.id}>
              <h2 className="text-sm font-semibold mb-2" style={{ fontFamily: "var(--font-display)" }}>{cat.name}</h2>
              <div className="space-y-1.5">
                {skills.map((s) => {
                  const st = statusOf(statuses, s.id);
                  const unlocked = isUnlocked(s, statuses);
                  return (
                    <div key={s.id} className="core-panel p-3" style={{ opacity: unlocked ? 1 : 0.5 }}>
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <div className="min-w-0 flex items-center gap-2 flex-wrap">
                          <span className="caption tabular-nums" style={{ color: "var(--ink-muted)" }}>
                            Nivå {s.level}
                          </span>
                          <span className="font-medium text-sm">{s.question}</span>
                        </div>
                        <div className="inline-flex gap-1 shrink-0">
                          <span
                            className="rounded-full border px-2.5 py-1 caption font-medium"
                            style={{
                              background: st === "not_started" ? "transparent" : STATUS_COLOR[st],
                              borderColor: STATUS_COLOR[st],
                              color: st === "not_started" ? "var(--ink-muted)" : "#111",
                            }}
                          >
                            {STATUS_LABEL[st]}
                          </span>
                        </div>
                      </div>

                      {!unlocked ? (
                        <p className="caption" style={{ color: "var(--ink-muted)" }}>
                          Lås upp genom att klara föregående steg.
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

      {initialNote && (
        <div className="core-panel p-5">
          <p className="core-kicker mb-2">Tränaranteckning</p>
          <p className="body-small whitespace-pre-wrap" style={{ color: "var(--ink-secondary)" }}>{initialNote}</p>
        </div>
      )}
    </div>
  );
}
