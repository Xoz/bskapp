import type { SeasonPeriod, TrainingSession } from "./model";

export function sessionMinutes(session: Pick<TrainingSession, "blocks">) {
  return session.blocks.reduce((sum, block) => sum + block.minutes, 0);
}

export function sessionFitsPlan(session: TrainingSession) {
  return sessionMinutes(session) === session.plannedMinutes;
}

export function periodsOverlap(a: SeasonPeriod, b: SeasonPeriod) {
  return a.startsOn <= b.endsOn && b.startsOn <= a.endsOn;
}

export function skillMinutes(sessions: TrainingSession[]) {
  const totals = new Map<string, number>();
  for (const session of sessions) {
    for (const block of session.blocks) {
      const skillIds = block.exerciseId.split("+").slice(1);
      for (const skillId of skillIds) totals.set(skillId, (totals.get(skillId) ?? 0) + block.minutes);
    }
  }
  return totals;
}
