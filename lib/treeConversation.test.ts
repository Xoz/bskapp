import { describe, it, expect } from "vitest";
import { prepareTreeConversation, realDate } from "./treeConversation";
import { SKILLS } from "./skillTrappan";
describe("tree conversation preparation", () => {
  it("does not invent ability when no assessment exists", () => {
    const result = prepareTreeConversation(null, null, []);
    expect(result.focus).toEqual([]);
    expect(result.summary).not.toContain("Markerat som klart");
  });
  it("uses stable skill order and explicit selections", () => {
    const rows = SKILLS.slice(0, 3).map((s) => ({
      skill_id: s.id,
      status: "training" as const,
      is_focus: 1,
    }));
    expect(prepareTreeConversation("a", "2026-09-09", rows)).toEqual(
      prepareTreeConversation("a", "2026-09-09", [...rows].reverse()),
    );
    expect(prepareTreeConversation("a", "2026-09-09", rows).focus).toHaveLength(
      2,
    );
  });
  it("validates actual calendar dates", () => {
    expect(realDate("2026-02-30")).toBe(false);
    expect(realDate("2024-02-29")).toBe(true);
  });
});
