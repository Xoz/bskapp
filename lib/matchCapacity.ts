export const MATCH_CAPACITY_WINDOW_HOURS = 7 * 24;
export const MATCH_CAPACITY_COST = 50;

export type PlayedMatchMoment = {
  date: string;
  startTime: string | null;
};

/**
 * Enkel exponeringsmätare för tränarens lånebeslut. Varje spelad match kostar
 * 50 procentenheter och avdraget tonas linjärt bort under sju dygn.
 * Resultatet uttrycker bara nyligt matchspel, aldrig medicinsk status.
 */
export function matchCapacity(
  matches: PlayedMatchMoment[],
  nowMs: number,
  wallClockToEpoch: (date: string, time: string) => number
): number {
  const windowMs = MATCH_CAPACITY_WINDOW_HOURS * 60 * 60 * 1000;
  const penalty = matches.reduce((total, match) => {
    const playedAt = wallClockToEpoch(match.date, match.startTime ?? "12:00");
    const elapsed = nowMs - playedAt;
    if (!Number.isFinite(playedAt) || elapsed < 0 || elapsed >= windowMs) return total;
    return total + MATCH_CAPACITY_COST * (1 - elapsed / windowMs);
  }, 0);
  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}
