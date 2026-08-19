import { describe, expect, it } from "vitest";
import { selectionSupport, squadBalanceWarnings } from "./selectionSupport";

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
});
