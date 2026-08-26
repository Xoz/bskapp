import { describe, expect, it } from "vitest";
import {
  recommendYellowSelection,
  selectionSupport,
  squadBalanceWarnings,
  type RecommendationCandidate,
} from "./selectionSupport";

function candidate(overrides: Partial<RecommendationCandidate> & Pick<RecommendationCandidate, "id" | "name" | "teamNames">): RecommendationCandidate {
  return {
    primaryTeamName: overrides.teamNames[0] ?? null,
    windowMatchCount: 0,
    lastSelectedDate: null,
    primaryLevel: "3",
    secondaryLevel: "",
    selectionEligible: true,
    currentlySelected: false,
    currentCallupStatus: null,
    ...overrides,
    recentMatchCount: overrides.recentMatchCount ?? overrides.windowMatchCount ?? 0,
    upcomingMatchCount: overrides.upcomingMatchCount ?? 0,
  };
}

describe("transparent uttagningsstöd", () => {
  it("lyfter låg exponering och aktiva mål utan poäng", () => {
    expect(
      selectionSupport({
        windowMatchCount: 0,
        recentMatchCount: 0,
        upcomingMatchCount: 0,
        teamMinimumWindow: 0,
        activeGoalCount: 1,
        lastSelectedDate: null,
      })
    ).toEqual({
      opportunities: [
        "Ingen match under perioden ±7 dagar",
        "Har ett aktivt utvecklingsmål att observera",
      ],
      cautions: [],
    });
  });

  it("markerar tre kommande matcher som maxgräns", () => {
    const result = selectionSupport({
      windowMatchCount: 3,
      recentMatchCount: 0,
      upcomingMatchCount: 3,
      teamMinimumWindow: 1,
      activeGoalCount: 0,
      lastSelectedDate: "2026-08-15",
    });
    expect(result.cautions).toContain("Vid maxgränsen: 0 spelade · 3 kommande");
  });

  it("visar lagbalans som varningar, inte automatval", () => {
    expect(
      squadBalanceWarnings([
        { recentMatchCount: 2, upcomingMatchCount: 3 },
        { recentMatchCount: 3, upcomingMatchCount: 3 },
      ])
    ).toEqual([
      "1 spelare har för hög belastning",
      "Minst halva truppen är vid maxgränsen eller över",
    ]);
  });

  it("rättvisejämför bara Gul och använder lån först när Gul inte räcker", () => {
    const result = recommendYellowSelection({
      matchLevel: 3,
      targetSize: 2,
      candidates: [
        candidate({ id: 1, name: "Gul låg", teamNames: ["Gul"], windowMatchCount: 1 }),
        candidate({ id: 2, name: "Gul hög", teamNames: ["Gul"], windowMatchCount: 4 }),
        candidate({ id: 3, name: "F15 noll", teamNames: ["F15"], windowMatchCount: 0 }),
        candidate({ id: 4, name: "Grön noll", teamNames: ["Grön"], windowMatchCount: 0 }),
      ],
    });
    expect(result.selectedIds).toEqual([1, 2]);
    expect(result.yellowCount).toBe(2);
    expect(result.fillerCount).toBe(0);
  });

  it("använder periodens matchantal och nivå som utslagsregel", () => {
    const result = recommendYellowSelection({
      matchLevel: 3,
      targetSize: 1,
      candidates: [
        candidate({ id: 1, name: "Högre belastning", teamNames: ["Gul"], windowMatchCount: 3, primaryLevel: "3" }),
        candidate({ id: 2, name: "Rätt nivå", teamNames: ["Gul"], windowMatchCount: 2, primaryLevel: "3" }),
        candidate({ id: 3, name: "Utmaningsnivå", teamNames: ["Gul"], windowMatchCount: 2, primaryLevel: "2", secondaryLevel: "3" }),
      ],
    });
    expect(result.selectedIds).toEqual([2]);
    expect(result.reasons[2]).toContain("normal nivå");
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
        candidate({ id: 1, name: "Ej tillgänglig", teamNames: ["Gul"], selectionEligible: false, windowMatchCount: 0 }),
        candidate({ id: 2, name: "Tillgänglig", teamNames: ["Gul"], windowMatchCount: 4 }),
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

  it("tar inte hänsyn till position i rekommendationen", () => {
    const result = recommendYellowSelection({
      matchLevel: 3,
      targetSize: 1,
      candidates: [
        candidate({ id: 1, name: "Utespelare", teamNames: ["Gul"], windowMatchCount: 0 }),
        candidate({ id: 2, name: "Målvakt", teamNames: ["Gul"], windowMatchCount: 5 }),
      ],
    });
    expect(result.selectedIds).toEqual([1]);
  });

  it("bevarar Gröns trupp och fyller bara med rättvist valda Gul-lån", () => {
    const result = recommendYellowSelection({
      sourceTeam: "Grön",
      matchLevel: 3,
      targetSize: 3,
      candidates: [
        candidate({ id: 1, name: "Grön kallad", teamNames: ["Grön"], currentCallupStatus: "accepted" }),
        candidate({ id: 2, name: "Gul färre", teamNames: ["Gul"], windowMatchCount: 2 }),
        candidate({ id: 3, name: "Gul fler", teamNames: ["Gul"], windowMatchCount: 5 }),
        candidate({ id: 4, name: "F15", teamNames: ["F15"], windowMatchCount: 0 }),
      ],
    });
    expect(result.selectedIds).toEqual([1, 2, 3]);
    expect(result.reasons[2]).toContain("Rättvist Gul-lån");
    expect(result.selectedIds).not.toContain(4);
  });

  it("använder endast primärt lag för rättvisegruppen", () => {
    const result = recommendYellowSelection({
      matchLevel: 3,
      targetSize: 1,
      candidates: [
        candidate({ id: 1, name: "Primär F15", teamNames: ["F15", "Gul"], primaryTeamName: "F15", windowMatchCount: 0 }),
        candidate({ id: 2, name: "Primär Gul", teamNames: ["Gul", "Grön"], primaryTeamName: "Gul", windowMatchCount: 4 }),
      ],
    });
    expect(result.selectedIds).toEqual([2]);
    expect(result.yellowCount).toBe(1);
  });
});
