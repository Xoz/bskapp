import { describe, expect, it } from "vitest";
import {
  callupTotalsCoverKnownPlayers,
  countImportedCallupStatuses,
  isInSanktanDirectSyncWindow,
  sanktanDirectSyncWindow,
  selectionDecisionFromCallups,
  shouldFinalizeAcceptedCallups,
} from "./callupSync";

describe("kallelsesynk", () => {
  const known = [
    { name: "A", status: "accepted" as const },
    { name: "B", status: "declined" as const },
    { name: "C", status: "pending" as const },
  ];

  it("räknar individuella svar", () => {
    expect(countImportedCallupStatuses(known)).toEqual({ accepted: 1, declined: 1, pending: 1 });
  });

  it("tillåter att Svenska Lag-totalen innehåller spelare som saknar profil", () => {
    expect(callupTotalsCoverKnownPlayers({ accepted: 2, declined: 1, pending: 1 }, known)).toBe(true);
  });

  it("avvisar totaler som är mindre än de kopplade spelarraderna", () => {
    expect(callupTotalsCoverKnownPlayers({ accepted: 0, declined: 1, pending: 1 }, known)).toBe(false);
  });

  it("låter en synkad kallelse styra vilka som är markerade", () => {
    expect(selectionDecisionFromCallups(true, "declined", "rested")).toBe("selected");
    expect(selectionDecisionFromCallups(true, null, "selected")).toBe("rested");
  });

  it("behåller sparad uttagning när kallelse saknas", () => {
    expect(selectionDecisionFromCallups(false, null, "reserve")).toBe("reserve");
  });

  it("avgränsar direktsynken till förra kalenderveckan och sju dagar framåt", () => {
    expect(sanktanDirectSyncWindow("2026-08-25")).toEqual({
      previousWeekFrom: "2026-08-17",
      previousWeekTo: "2026-08-23",
      futureFrom: "2026-08-25",
      futureTo: "2026-09-01",
    });
    expect(isInSanktanDirectSyncWindow("2026-08-22", "2026-08-25")).toBe(true);
    expect(isInSanktanDirectSyncWindow("2026-08-24", "2026-08-25")).toBe(false);
    expect(isInSanktanDirectSyncWindow("2026-09-02", "2026-08-25")).toBe(false);
  });

  it("gör ja-svar till deltagande först dagen efter matchen", () => {
    expect(shouldFinalizeAcceptedCallups("2026-08-24", "2026-08-25")).toBe(true);
    expect(shouldFinalizeAcceptedCallups("2026-08-25", "2026-08-25")).toBe(false);
    expect(shouldFinalizeAcceptedCallups("2026-08-26", "2026-08-25")).toBe(false);
  });
});
