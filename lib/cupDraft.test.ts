import { describe, expect, it } from "vitest";
import { parseCupDraft } from "./cupDraft";
function draft(overrides: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ cup_name: " QA Cup ", match_count: "1", opponent_0: " QA Lag ", date_0: "2026-10-11", time_0: "12:30", ...overrides })) form.set(key, value);
  return form;
}
describe("cup request validation before persistence", () => {
  it("normalizes a complete draft", () => {
    expect(parseCupDraft(draft())).toEqual({ cupName: "QA Cup", matches: [{ opponent: "QA Lag", date: "2026-10-11", time: "12:30", homeAway: "home" }] });
  });
  it.each(["", "2026-02-30", "2026-13-01", "invalid"])("rejects missing or impossible date %s", date => {
    expect(parseCupDraft(draft({ date_0: date }))).toHaveProperty("error");
  });
  it.each(["0", "-1", "51", "1.5", "NaN"])("rejects invalid match count %s", count => {
    expect(parseCupDraft(draft({ match_count: count }))).toHaveProperty("error");
  });
  it("rejects the entire draft if a later match is incomplete", () => {
    expect(parseCupDraft(draft({ match_count: "2", opponent_1: "QA B" }))).toEqual({ error: "Match 2: ange motståndare och ett giltigt datum." });
  });
  it("allows optional kickoff and rejects invalid metadata", () => {
    expect(parseCupDraft(draft({ time_0: "" }))).not.toHaveProperty("error");
    for (const fields of ([{ time_0: "25:60" }, { home_away_0: "invalid" }, { opponent_0: "  " }, { cup_name: " " }] as Record<string, string>[])) {
      expect(parseCupDraft(draft(fields))).toHaveProperty("error");
    }
  });
});
