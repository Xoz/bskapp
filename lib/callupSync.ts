export type ImportedCallupStatus = "accepted" | "declined" | "pending";
export type SavedSelectionDecision = "selected" | "reserve" | "rested";

export type ImportedCallupPlayer = {
  name: string;
  status: ImportedCallupStatus;
};

export type ImportedCallupTotals = {
  accepted: number;
  declined: number;
  pending: number;
};

export type SanktanDirectSyncWindow = {
  previousWeekFrom: string;
  previousWeekTo: string;
  futureFrom: string;
  futureTo: string;
};

function shiftIsoDate(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error("Ogiltigt kalenderdatum.");
  }
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

/** Förra kalenderveckan samt idag till och med sju dagar framåt. */
export function sanktanDirectSyncWindow(today: string): SanktanDirectSyncWindow {
  const parsed = new Date(`${today}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== today) {
    throw new Error("Ogiltigt kalenderdatum.");
  }
  const daysSinceMonday = (parsed.getUTCDay() + 6) % 7;
  return {
    previousWeekFrom: shiftIsoDate(today, -daysSinceMonday - 7),
    previousWeekTo: shiftIsoDate(today, -daysSinceMonday - 1),
    futureFrom: today,
    futureTo: shiftIsoDate(today, 7),
  };
}

export function isInSanktanDirectSyncWindow(date: string, today: string): boolean {
  const window = sanktanDirectSyncWindow(today);
  return (date >= window.previousWeekFrom && date <= window.previousWeekTo)
    || (date >= window.futureFrom && date <= window.futureTo);
}

/** Ett kvarstående ja blir deltagande först kalenderdagen efter matchen. */
export function shouldFinalizeAcceptedCallups(activityDate: string, today: string): boolean {
  return activityDate < today;
}

export function countImportedCallupStatuses(callups: readonly ImportedCallupPlayer[]): ImportedCallupTotals {
  return callups.reduce<ImportedCallupTotals>((totals, callup) => {
    totals[callup.status] += 1;
    return totals;
  }, { accepted: 0, declined: 0, pending: 0 });
}

/** Fullständiga Svenska Lag-totaler får innehålla fler personer än appens aktiva spelarregister. */
export function callupTotalsCoverKnownPlayers(
  totals: ImportedCallupTotals,
  knownCallups: readonly ImportedCallupPlayer[]
): boolean {
  if (Object.values(totals).some((value) => !Number.isInteger(value) || value < 0)) return false;
  const known = countImportedCallupStatuses(knownCallups);
  return known.accepted <= totals.accepted
    && known.declined <= totals.declined
    && known.pending <= totals.pending;
}

/**
 * Kallelse och uttagningsbeslut är separata saker. Ett ja är en låst plats i
 * truppen, medan nej och inväntar aldrig blir uttagna. Okallade spelare får
 * behålla ett manuellt beslut tills tränaren ändrar det.
 */
export function selectionDecisionFromCallups(
  hasSyncedCallups: boolean,
  currentCallupStatus: ImportedCallupStatus | null,
  savedDecision: SavedSelectionDecision | null
): SavedSelectionDecision {
  if (!hasSyncedCallups || currentCallupStatus === null) return savedDecision ?? "rested";
  return currentCallupStatus === "accepted" ? "selected" : "rested";
}
