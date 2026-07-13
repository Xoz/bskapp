import { describe, expect, it } from "vitest";
import { diagramSchema, emptyDiagram, parse, serialize } from "./diagram";
import { arrowPath } from "../components/diagram/diagramRender";

const sample = () => ({
  widthRatio: 0.65,
  objects: [
    { id: "p1", type: "player" as const, x: 0.2, y: 0.5, team: "att" as const, label: "9" },
    { id: "b", type: "ball" as const, x: 0.25, y: 0.5 },
  ],
  arrows: [{ id: "a1", kind: "pass" as const, from: { objectId: "p1" }, to: { point: [0.5, 0.5] as [number, number] }, order: 0 }],
});

describe("diagram format", () => {
  it("round-trip: serialize → parse ger tillbaka samma diagram", () => {
    const d = sample();
    expect(parse(serialize(d))).toEqual(d);
    expect(parse(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });
  it("avvisar ogiltig indata (koordinat utanför 0–1, okänd typ, endpoint utan referens)", () => {
    expect(() => diagramSchema.parse({ ...sample(), objects: [{ id: "x", type: "ufo", x: 0.5, y: 0.5 }] })).toThrow();
    expect(() => diagramSchema.parse({ ...sample(), objects: [{ id: "x", type: "ball", x: 1.5, y: 0.5 }] })).toThrow();
    expect(() => diagramSchema.parse({ widthRatio: 0.65, objects: [], arrows: [{ id: "a", kind: "pass", from: {}, to: {}, order: 0 }] })).toThrow();
  });
  it("emptyDiagram validerar", () => { expect(parse(serialize(emptyDiagram()))).toEqual(emptyDiagram()); });
  it("ritar raka och sicksackade rörelselinjer", () => {
    expect(arrowPath("pass", [10, 20], [30, 40])).toBe("M 10 20 L 30 40");
    expect(arrowPath("dribble", [10, 20], [30, 40]).split(" L ")).toHaveLength(9);
  });
});
