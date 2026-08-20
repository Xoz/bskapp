import { describe, expect, it } from "vitest";
import { callupTotalsCoverKnownPlayers, countImportedCallupStatuses } from "./callupSync";

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
});
