import { describe, it, expect } from "vitest";
import { BANK, validDiagram, validPlan } from "./model";
import { drawing } from "./drawing";
describe("original KLVR drawing format", () => {
  it("accepts all 15 original templates without coordinate conversion", () => {
    expect(BANK).toHaveLength(15);
    for (const item of BANK) {
      expect(validDiagram(item.model), item.id).toBe(true);
      expect(drawing(item.model, null)).toContain("viewBox");
    }
  });
  it("rejects malformed, duplicate and injectable objects", () => {
    const model = structuredClone(BANK[0].model);
    model.objects.push({ ...model.objects[0] });
    expect(validDiagram(model)).toBe(false);
    model.objects.pop();
    model.objects[0].id = 'x" onload="alert(1)';
    expect(validDiagram(model)).toBe(false);
    expect(validDiagram({ ...model, objects: [null] })).toBe(false);
  });
  it("escapes labels rather than executing markup", () => {
    const model = structuredClone(BANK[0].model);
    model.objects[0].type = "text";
    model.objects[0].label = "<script>alert(1)</script>";
    expect(drawing(model, null)).not.toContain("<script>");
    expect(drawing(model, null)).toContain("&lt;script&gt;");
  });
  it("validates plan dates, durations and block ids", () => {
    const plan = {
      version: 1,
      title: "Pass",
      date: "2026-09-09",
      blocks: [{ id: "a", minutes: 10, diagram: BANK[0].model }],
    };
    expect(validPlan(plan)).toBe(true);
    expect(validPlan({ ...plan, date: "2026-02-30" })).toBe(false);
    expect(
      validPlan({ ...plan, blocks: [{ ...plan.blocks[0], minutes: 0 }] }),
    ).toBe(false);
    expect(
      validPlan({ ...plan, blocks: [plan.blocks[0], plan.blocks[0]] }),
    ).toBe(false);
  });
});
