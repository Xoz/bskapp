export const MATCH_CAPACITY_WINDOW_HOURS = 7 * 24;
export const MATCH_CAPACITY_COST = 50;

export type MatchLoadLevel = "normal" | "maximum" | "high";

export type MatchLoadAssessment = {
  level: MatchLoadLevel;
  recentMatchCount: number;
  upcomingMatchCount: number;
  totalMatchCount: number;
};

export type PlayedMatchMoment = {
  date: string;
  startTime: string | null;
};

/**
 * Operativ belastningsregel för ett rullande sjudygnsfönster bakåt och framåt.
 * Fyra matcher är normalt om högst två ligger framåt. Fem totalt eller tre
 * kommande är maxgränsen. Sex totalt, fyra kommande eller fem redan spelade är
 * för hög belastning.
 */
export function assessMatchLoad(
  recentMatchCount: number,
  upcomingMatchCount: number
): MatchLoadAssessment {
  const recent = Math.max(0, Math.floor(recentMatchCount));
  const upcoming = Math.max(0, Math.floor(upcomingMatchCount));
  const total = recent + upcoming;
  const level: MatchLoadLevel = recent >= 5 || upcoming >= 4 || total >= 6
    ? "high"
    : upcoming === 3 || total === 5
      ? "maximum"
      : "normal";
  return {
    level,
    recentMatchCount: recent,
    upcomingMatchCount: upcoming,
    totalMatchCount: total,
  };
}

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
