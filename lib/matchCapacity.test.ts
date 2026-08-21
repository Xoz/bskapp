import { describe, expect, it } from "vitest";
import { matchCapacity } from "./matchCapacity";

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
