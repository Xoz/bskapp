import { describe, expect, it } from "vitest";
import { matchEvaluationIsOpen } from "./matchEvaluation";

describe("matchutvärderingens öppningstid", () => {
  it("öppnar 90 minuter efter avspark på matchdagen", () => {
    expect(matchEvaluationIsOpen("2026-08-21", "18:45", "2026-08-21", 20 * 60 + 14)).toBe(false);
    expect(matchEvaluationIsOpen("2026-08-21", "18:45", "2026-08-21", 20 * 60 + 15)).toBe(true);
  });

  it("är öppen för passerade matcher men inte framtida eller tidlösa matcher", () => {
    expect(matchEvaluationIsOpen("2026-08-20", "18:45", "2026-08-21", 0)).toBe(true);
    expect(matchEvaluationIsOpen("2026-08-22", "09:15", "2026-08-21", 23 * 60)).toBe(false);
    expect(matchEvaluationIsOpen("2026-08-21", null, "2026-08-21", 23 * 60)).toBe(false);
  });
});
