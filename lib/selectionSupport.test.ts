import { describe, expect, it } from "vitest";
import {
  recommendYellowSelection,
  selectionSupport,
  squadBalanceWarnings,
  type RecommendationCandidate,
} from "./selectionSupport";

function candidate(overrides: Partial<RecommendationCandidate> & Pick<RecommendationCandidate, "id" | "name" | "teamNames">): RecommendationCandidate {
  return {
    callupCount: 0,
    plannedUpcomingCount: 0,
    lastSelectedDate: null,
    primaryLevel: "3",
    secondaryLevel: "",
    primaryPosition: "Mittfält",
    secondaryPosition: "",
    selectionEligible: true,
    currentCallupStatus: null,
    ...overrides,
  };
}

describe("transparent uttagningsstöd", () => {
  it("lyfter låg exponering och aktiva mål utan poäng", () => {
    expect(
      selectionSupport({
        selectedLastEight: 0,
        selectedLastThree: 0,
        teamMinimumLastEight: 0,
        activeGoalCount: 1,
        lastSelectedDate: null,
      })
    ).toEqual({
      opportunities: [
        "Ingen spelad Sanktanmatch bland de senaste åtta matchtillfällena",
        "Har ett aktivt utvecklingsmål att observera",
      ],
      cautions: [],
    });
  });

  it("varnar för tre raka Sanktanmatcher", () => {
    const result = selectionSupport({
      selectedLastEight: 5,
      selectedLastThree: 3,
      teamMinimumLastEight: 1,
      activeGoalCount: 0,
      lastSelectedDate: "2026-08-15",
    });
    expect(result.cautions).toContain("Har spelat tre Sanktanmatcher i följd");
  });

  it("visar lagbalans som varningar, inte automatval", () => {
    expect(
      squadBalanceWarnings([
        { position: "Försvar", selectedLastThree: 3 },
        { position: "Mittfält", selectedLastThree: 3 },
      ])
    ).toEqual([
      "Truppen saknar registrerat målvaktsalternativ",
      "Minst halva truppen har redan tre uttagningar i följd",
    ]);
  });

  it("rättvisejämför bara Gul och använder lån först när Gul inte räcker", () => {
    const result = recommendYellowSelection({
      matchLevel: 3,
      targetSize: 2,
      candidates: [
        candidate({ id: 1, name: "Gul låg", teamNames: ["Gul"], callupCount: 1 }),
        candidate({ id: 2, name: "Gul hög", teamNames: ["Gul"], callupCount: 4 }),
        candidate({ id: 3, name: "F15 noll", teamNames: ["F15"], callupCount: 0 }),
        candidate({ id: 4, name: "Grön noll", teamNames: ["Grön"], callupCount: 0 }),
      ],
    });
    expect(result.selectedIds).toEqual([1, 2]);
    expect(result.yellowCount).toBe(2);
    expect(result.fillerCount).toBe(0);
  });

  it("räknar redan planerade uttagningar i rättvisan och använder nivå som utslagsregel", () => {
    const result = recommendYellowSelection({
      matchLevel: 3,
      targetSize: 1,
      candidates: [
        candidate({ id: 1, name: "Redan planerad", teamNames: ["Gul"], callupCount: 2, plannedUpcomingCount: 1, primaryLevel: "3" }),
        candidate({ id: 2, name: "Rätt nivå", teamNames: ["Gul"], callupCount: 2, primaryLevel: "3" }),
        candidate({ id: 3, name: "Sekundär nivå", teamNames: ["Gul"], callupCount: 2, primaryLevel: "2", secondaryLevel: "3" }),
      ],
    });
    expect(result.selectedIds).toEqual([2]);
    expect(result.reasons[2]).toContain("primär nivå");
  });

  it("bevarar skickade kallelser och väljer inte spelare som tackat nej", () => {
    const result = recommendYellowSelection({
      matchLevel: 3,
      targetSize: 2,
      candidates: [
        candidate({ id: 1, name: "Redan kallad", teamNames: ["Gul"], currentCallupStatus: "pending" }),
        candidate({ id: 2, name: "Tackat nej", teamNames: ["Gul"], currentCallupStatus: "declined" }),
        candidate({ id: 3, name: "Tillgänglig", teamNames: ["Gul"] }),
      ],
    });
    expect(result.selectedIds).toEqual([1, 3]);
    expect(result.reasons[1]).toBe("Redan kallad");
  });

  it("väljer inte en spelare som tillfälligt stängts av från automatiska förslag", () => {
    const result = recommendYellowSelection({
      matchLevel: 3,
      targetSize: 1,
      candidates: [
        candidate({ id: 1, name: "Ej tillgänglig", teamNames: ["Gul"], selectionEligible: false, callupCount: 0 }),
        candidate({ id: 2, name: "Tillgänglig", teamNames: ["Gul"], callupCount: 4 }),
      ],
    });
    expect(result.selectedIds).toEqual([2]);
  });

  it("spärrar F15 på nivå 4 och använder Grön som sista utfyllnad", () => {
    const result = recommendYellowSelection({
      matchLevel: 4,
      targetSize: 2,
      candidates: [
        candidate({ id: 1, name: "Enda Gul", teamNames: ["Gul"], primaryLevel: "4" }),
        candidate({ id: 2, name: "F15", teamNames: ["F15"], primaryLevel: "3", currentCallupStatus: "pending" }),
        candidate({ id: 3, name: "Grön", teamNames: ["Grön"], primaryLevel: "4" }),
      ],
    });
    expect(result.selectedIds).toEqual([1, 3]);
    expect(result.reasons[3]).toContain("Grön-utfyllnad");
  });

  it("prioriterar registrerad Gulmålvakt som hårt positionskrav", () => {
    const result = recommendYellowSelection({
      matchLevel: 3,
      targetSize: 1,
      candidates: [
        candidate({ id: 1, name: "Utespelare", teamNames: ["Gul"], callupCount: 0 }),
        candidate({ id: 2, name: "Målvakt", teamNames: ["Gul"], callupCount: 5, primaryPosition: "Målvakt" }),
      ],
    });
    expect(result.selectedIds).toEqual([2]);
    expect(result.reasons[2]).toContain("Målvakt");
  });
});
