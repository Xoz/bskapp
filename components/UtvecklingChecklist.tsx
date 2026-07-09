"use client";

import { useState, useTransition } from "react";
import {
  CATEGORIES,
  skillsByCategory,
  allCategoryProgress,
  filterSkills,
  isUnlocked,
  nextRecommendedSkill,
  priorityAreas,
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
  { mode: "all", label: "Alla" },
  { mode: "level1", label: "Nivå 1" },
  { mode: "level2", label: "Nivå 2" },
  { mode: "next", label: "Nästa steg" },
];

const STATUS_SEQUENCE: SkillStatus[] = ["not_started", "training", "almost", "done"];

export default function UtvecklingChecklist({
  playerId,
  firstName,
  initialStatuses,
  initialNote,
}: {
  playerId: number;
  firstName: string;
  initialStatuses: StatusMap;
  initialNote: string;
}) {
  const [statuses, setStatuses] = useState(initialStatuses);
  const [note, setNote] = useState(initialNote);
  const [role, setRole] = useState<"coach" | "player">("coach");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
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
  const priorities = priorityAreas(statuses);
  const next = nextRecommendedSkill(statuses);
  const catProgress = allCategoryProgress(statuses);
  const categoriesToShow = categoryFilter === "all" ? CATEGORIES : CATEGORIES.filter((c) => c.id === categoryFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <div className="inline-flex rounded-full p-0.5 gap-0.5 text-xs" style={{ background: "var(--bg2)", border: "1px solid var(--line)" }}>
          {(["coach", "player"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className="px-3 py-1.5 rounded-full font-medium transition-colors"
              style={
                role === r
                  ? { background: "var(--primary)", color: "var(--primary-deep)" }
                  : { color: "var(--ink-faint)" }
              }
            >
              {r === "coach" ? "Tränarvy" : "Spelarvy"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="eyebrow mb-2">Total utvecklingsnivå</p>
          <div className="flex items-center justify-between mb-2">
            <span className="stat-number text-2xl">{total.percent}%</span>
            <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
              {total.done}/{total.total} klara
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "var(--bg3)" }}>
            <div className="h-full rounded-full" style={{ width: `${total.percent}%`, background: "var(--primary)" }} />
          </div>
        </div>
        <div className="card p-5">
          <p className="eyebrow mb-2">Nästa rekommenderade färdighet</p>
          {next ? (
            <>
              <p className="font-medium text-sm mb-0.5">{next.title}</p>
              <p className="text-xs" style={{ color: "var(--ink-soft)" }}>{next.question}</p>
            </>
          ) : (
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Allt klart – grymt jobbat! 🎉</p>
          )}
        </div>
      </div>

      <div>
        <p className="eyebrow mb-2">3 prioriterade träningsområden</p>
        <div className="flex flex-wrap gap-2">
          {priorities.map((p) => {
            const cat = CATEGORIES.find((c) => c.id === p.category)!;
            return (
              <button
                key={p.category}
                type="button"
                onClick={() => setCategoryFilter(p.category)}
                className="badge"
                style={{ background: "var(--bg2)", color: "var(--ink)", border: "1px solid var(--line)" }}
              >
                {cat.icon} {cat.name} <span style={{ color: "var(--ink-faint)" }}>{p.percent}%</span>
              </button>
            );
          })}
        </div>
      </div>

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
                border: `1px solid ${active ? cat.color : "var(--line)"}`,
                background: active ? `color-mix(in srgb, ${cat.color}, transparent 90%)` : "var(--bg2)",
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
                ? { background: "var(--primary-soft)", color: "var(--primary-fg)", border: "1px solid var(--primary-line)" }
                : { color: "var(--ink-faint)", border: "1px solid var(--line)" }
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
            style={{ color: "var(--ink-faint)", border: "1px solid var(--line)" }}
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
                          <span className="text-xs tabular-nums" style={{ color: "var(--ink-faint)" }}>
                            Nivå {s.level}
                          </span>
                          <span className="font-medium text-sm">{s.question}</span>
                        </div>
                        <div className="inline-flex gap-1 shrink-0">
                          {STATUS_SEQUENCE.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              disabled={!unlocked}
                              title={STATUS_LABEL[opt]}
                              onClick={() => updateStatus(s.id, opt)}
                              className="w-6 h-6 rounded-full border transition disabled:opacity-30 disabled:cursor-not-allowed"
                              style={{
                                background: st === opt ? STATUS_COLOR[opt] : "transparent",
                                borderColor: STATUS_COLOR[opt],
                              }}
                            />
                          ))}
                        </div>
                      </div>

                      {!unlocked ? (
                        <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
                          🔒 Lås upp genom att klara föregående steg.
                        </p>
                      ) : (
                        <>
                          <p className="text-xs mb-1" style={{ color: "var(--ink-soft)" }}>
                            <span style={{ color: "var(--ink-faint)" }}>Klart när: </span>
                            {s.criterion}
                          </p>
                          {st !== "done" ? (
                            <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
                              <span style={{ color: "var(--ink-faint)" }}>Träningsråd: </span>
                              {s.advice}
                            </p>
                          ) : (
                            <p className="text-xs" style={{ color: "#1fba8a" }}>
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

      {role === "coach" && (
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
