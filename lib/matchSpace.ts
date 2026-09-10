/** Tränarens planeringsmodell v1. Poängen är antaganden, inte uppmätt ork. */
export const MATCH_SPACE = { defaultCapacity: 100, recoveryPerDay: 20, matchPerMinute: 0.5, trainingPerMinute: 0.25, reserve: 0.4, caution: 0.6 } as const;
export type SpaceLevel = "normal" | "maximum" | "high";
export type SpaceEvent = {
  id: string; title: string; start: number; duration: number; minutes: number;
  kind: "match" | "training"; planned: boolean; estimated: boolean;
};
export type SpaceInput = { sourceWarning?: string; capacity: number; now: number; events: SpaceEvent[]; target?: SpaceEvent };
export type SpaceForecast = {
  capacity: number; current: number; before: number; after: number; lowest: number;
  level: SpaceLevel; conflict: boolean; nextAffected: string | null; estimated: boolean;
};
export const spaceLabels: Record<SpaceLevel, string> = { normal: "Gott utrymme", maximum: "Begränsat utrymme", high: "Prioritera vila" };

export function validCapacity(value: number): boolean {
  return Number.isInteger(value) && value >= 50 && value <= 150;
}

/** Simulerar den aktuella matchen exakt en gång, även om spelaren redan är kallad.
 * Återhämtning sker bara utanför aktiviteternas hela tidsintervall. Negativ
 * intern balans bevaras, så överbelastning inte försvinner genom klippning.
 */
export function forecastMatchSpace(input: SpaceInput, targetMinutes?: number): SpaceForecast {
  const capacity = validCapacity(input.capacity) ? input.capacity : MATCH_SPACE.defaultCapacity;
  const target = input.target ? { ...input.target, minutes: Math.max(0, Math.min(input.target.duration, targetMinutes ?? input.target.minutes)) } : undefined;
  const events = [...new Map(input.events.filter(e => e.id !== target?.id).map(e => [e.id, e])).values()];
  if (target) events.push(target);
  events.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  const cost = (e: SpaceEvent) => e.minutes * (e.kind === "match" ? MATCH_SPACE.matchPerMinute : MATCH_SPACE.trainingPerMinute);
  const recover = (balance: number, elapsed: number) => Math.min(capacity, balance + Math.max(0, elapsed) / 86400000 * MATCH_SPACE.recoveryPerDay);
  const run = (until: number, actualOnly = false) => {
    let balance = capacity, busyUntil = -Infinity;
    for (const event of events) {
      if (event.start > until || (actualOnly && event.planned)) continue;
      balance = recover(balance, event.start - busyUntil) - cost(event);
      busyUntil = Math.max(busyUntil, event.start + (event.minutes > 0 ? event.duration : 0) * 60000);
    }
    return recover(balance, until - busyUntil);
  };
  const current = run(input.now, true);
  let balance = capacity, busyUntil = -Infinity, before = current, after = current;
  let lowest = target ? Infinity : current, conflict = false, nextAffected: string | null = null;
  for (const event of events) {
    balance = recover(balance, event.start - busyUntil);
    if (event.id === target?.id) before = balance;
    balance -= cost(event);
    if (event.id === target?.id) after = balance;
    if (event.start >= (target?.start ?? input.now)) {
      lowest = Math.min(lowest, balance);
      if (event.id !== target?.id && event.kind === "match" && balance < capacity * MATCH_SPACE.reserve && !nextAffected) nextAffected = event.title;
    }
    if (target && event.id !== target.id && event.minutes > 0 && target.minutes > 0
      && event.start < target.start + target.duration * 60000 && event.start + event.duration * 60000 > target.start) conflict = true;
    busyUntil = Math.max(busyUntil, event.start + (event.minutes > 0 ? event.duration : 0) * 60000);
  }
  if (!Number.isFinite(lowest)) lowest = current;
  const level: SpaceLevel = conflict || lowest < capacity * MATCH_SPACE.reserve ? "high" : lowest < capacity * MATCH_SPACE.caution ? "maximum" : "normal";
  const display = (n: number) => Math.round(Math.max(0, Math.min(capacity, n)));
  return { capacity, current: display(current), before: display(before), after: display(after), lowest: display(lowest), level, conflict, nextAffected,
    estimated: events.length === 0 || events.some(e => e.estimated) };
}
