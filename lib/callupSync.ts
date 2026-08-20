export type ImportedCallupStatus = "accepted" | "declined" | "pending";

export type ImportedCallupPlayer = {
  name: string;
  status: ImportedCallupStatus;
};

export type ImportedCallupTotals = {
  accepted: number;
  declined: number;
  pending: number;
};

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
