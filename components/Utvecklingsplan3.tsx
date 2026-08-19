"use client";

import { useMemo, useState, useTransition } from "react";
import { setDevelopmentPlanStepStatus } from "@/lib/actions";
import {
  STATUS_COLOR,
  STATUS_LABEL,
  type SkillStatus,
  type StatusMap,
} from "@/lib/skillTrappan";
import {
  DEVELOPMENT_PLAN_AREAS,
  DEVELOPMENT_PLAN_STEP_IDS,
  DEVELOPMENT_PLAN_STEPS,
  getNextPlanStep,
  getPlanAreaDoneCount,
  getPlanAreaSteps,
  isPlanStepUnlocked,
  statusOfPlanStep,
  type DevelopmentPlanAreaId,
} from "@/lib/developmentPlan";

const STATUS_SEQUENCE: SkillStatus[] = ["not_started", "training", "almost", "done"];

const STATUS_BUTTON_LABEL: Record<SkillStatus, string> = {
  not_started: "Ej påbörjad",
  training: "Övar",
  almost: "Nästan klar",
  done: "Klar",
};

export default function Utvecklingsplan3({
  playerId,
  initialStatuses,
  readOnly = false,
}: {
  playerId: number;
  initialStatuses: StatusMap;
  readOnly?: boolean;
}) {
  const [statuses, setStatuses] = useState(initialStatuses);
  const [, startTransition] = useTransition();

  function updateStatus(stepId: string, status: SkillStatus) {
    if (readOnly) return;
    setStatuses((prev) => ({ ...prev, [stepId]: status }));
    startTransition(() => {
      setDevelopmentPlanStepStatus(playerId, stepId, status);
    });
  }

  const summary = useMemo(() => {
    const totalDone = DEVELOPMENT_PLAN_STEP_IDS.filter((id) => statusOfPlanStep(statuses, id) === "done").length;
    const allDone = totalDone === DEVELOPMENT_PLAN_STEP_IDS.length;
    return {
      totalDone,
      allDone,
    };
  }, [statuses]);

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-3">
        {DEVELOPMENT_PLAN_AREAS.map((area) => {
          const done = getPlanAreaDoneCount(area.id, statuses);
          const next = getNextPlanStep(area.id, statuses);
          return (
            <article
              key={area.id}
              className="card p-4"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <p className="flex items-center gap-2 font-semibold">
                <span aria-hidden>{area.icon}</span>
                <span>{area.name}</span>
              </p>
              <p className="caption mt-1" style={{ color: "var(--ink-muted)" }}>
                {done} av 3 klara steg
              </p>
              <p className="caption mt-2" style={{ color: area.color }}>
                {next ? `Nästa steg: ${next.label}` : "Alla steg klara 🔥"}
              </p>
            </article>
          );
        })}
      </div>

      <div className="card p-4">
        <p className="eyebrow mb-3">Total framdrift</p>
        <div className="flex items-center justify-between mb-2">
          <p className="font-medium">{summary.totalDone} av 9 steg klara</p>
          <span className="caption" style={{ color: "var(--ink-muted)" }}>
            {summary.allDone ? "Färdig stege 🌟" : "Fortsätt nästa steg"}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "var(--elevated)" }}>
          <div className="h-full rounded-full" style={{ width: `${Math.round((summary.totalDone / 9) * 100)}%`, background: "var(--primary)" }} />
        </div>
      </div>

      {(DEVELOPMENT_PLAN_AREAS as readonly { id: DevelopmentPlanAreaId; name: string; icon: string; color: string }[]).map((area) => {
        const steps = getPlanAreaSteps(area.id);
        return (
          <section key={`section-${area.id}`} className="card p-4">
            <p className="font-semibold flex items-center gap-2">
              <span aria-hidden>{area.icon}</span>
              {area.name}
            </p>
            <div className="mt-3 space-y-2">
              {steps.map((step) => {
                const status = statusOfPlanStep(statuses, step.id);
                const unlocked = isPlanStepUnlocked(step, statuses);
                return (
                  <div key={step.id} className="p-3 rounded-lg border" style={{ borderColor: unlocked ? "var(--border)" : "var(--ink-faint)", opacity: unlocked ? 1 : 0.55 }}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="text-sm font-medium">{step.label}</p>
                        <p className="caption" style={{ color: "var(--ink-secondary)" }}>{step.question}</p>
                      </div>
                      {!unlocked && (
                        <span className="caption" style={{ color: "var(--ink-muted)" }} title="Steget låses upp när föregående klars">
                          🔒
                        </span>
                      )}
                    </div>
                    {!unlocked ? (
                      <p className="caption mb-2" style={{ color: "var(--ink-muted)" }}>
                        Lås upp när föregående steg är klarat.
                      </p>
                    ) : (
                      <>
                        <p className="caption mb-1" style={{ color: "var(--ink-secondary)" }}>
                          <span style={{ color: "var(--ink-muted)" }}>Bedömning: </span>
                          {step.criterion}
                        </p>
                        <p className="caption mb-2" style={{ color: "var(--ink-secondary)" }}>
                          <span style={{ color: "var(--ink-muted)" }}>Träningsråd: </span>
                          {step.advice}
                        </p>
                      </>
                    )}
                    <div className="inline-flex flex-wrap gap-1">
                      {STATUS_SEQUENCE.map((statusOption) => (
                        <button
                          key={`${step.id}-${statusOption}`}
                          type="button"
                          disabled={readOnly || !unlocked}
                          onClick={() => updateStatus(step.id, statusOption)}
                          className="rounded-full border px-2 py-1 text-[11px] transition"
                          style={{
                            borderColor: STATUS_COLOR[statusOption],
                            color: status === statusOption ? "#111" : "var(--ink-muted)",
                            background: status === statusOption ? STATUS_COLOR[statusOption] : "transparent",
                          }}
                        >
                          {STATUS_BUTTON_LABEL[statusOption]}
                        </button>
                      ))}
                    </div>
                    <p className="caption mt-2" style={{ color: "var(--ink-muted)" }}>
                      Nuvarande status: {STATUS_LABEL[status]}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

    </div>
  );
}

