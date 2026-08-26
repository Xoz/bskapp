import { describe, expect, it } from "vitest";
import { assessMatchLoad, matchCapacity } from "./matchCapacity";

const epoch = (date: string, time: string) => Date.parse(`${date}T${time}:00Z`);
const now = epoch("2026-08-21", "12:00");

describe("matchCapacity", () => {
  it("ger 100 när ingen match spelats under sjudygnsfönstret", () => {
    expect(matchCapacity([], now, epoch)).toBe(100);
    expect(matchCapacity([{ date: "2026-08-14", startTime: "12:00" }], now, epoch)).toBe(100);
  });

  it("drar av 50 för en nyss spelad match och 100 för två", () => {
    expect(matchCapacity([{ date: "2026-08-21", startTime: "12:00" }], now, epoch)).toBe(50);
    expect(matchCapacity([
      { date: "2026-08-21", startTime: "12:00" },
      { date: "2026-08-21", startTime: "12:00" },
    ], now, epoch)).toBe(0);
  });

  it("fyller tillbaka matchavdraget linjärt under sju dygn", () => {
    expect(matchCapacity([{ date: "2026-08-18", startTime: "00:00" }], now, epoch)).toBe(75);
  });

  it("ignorerar framtida matcher", () => {
    expect(matchCapacity([{ date: "2026-08-22", startTime: "12:00" }], now, epoch)).toBe(100);
  });
});

describe("assessMatchLoad", () => {
  it.each([
    [0, 0],
    [0, 2],
    [2, 2],
    [3, 1],
    [4, 0],
  ])("bedömer %i spelade och %i kommande som normalt", (recent, upcoming) => {
    expect(assessMatchLoad(recent, upcoming).level).toBe("normal");
  });

  it.each([
    [0, 3],
    [1, 3],
    [2, 3],
    [3, 2],
    [4, 1],
  ])("bedömer %i spelade och %i kommande som maxgräns", (recent, upcoming) => {
    expect(assessMatchLoad(recent, upcoming).level).toBe("maximum");
  });

  it.each([
    [0, 4],
    [3, 3],
    [4, 2],
    [5, 0],
  ])("bedömer %i spelade och %i kommande som för hög belastning", (recent, upcoming) => {
    expect(assessMatchLoad(recent, upcoming).level).toBe("high");
  });
});
