import { describe, expect, it } from "vitest";
import { selectMatchRoster } from "./matchRoster";

const candidate = (matchId: number, id: number, source: Parameters<typeof selectMatchRoster>[2][number]["source"]) => ({
  match_id: matchId,
  id,
  name: `Spelare ${id}`,
  jersey_number: id,
  source,
});

describe("gemensam matchtrupp", () => {
  it("använder den kanoniska uttagningen på en kommande match", () => {
    const roster = selectMatchRoster(10, false, [
      candidate(10, 3, "confirmed"),
    ]);
    expect(roster.source).toBe("confirmed");
    expect(roster.confirmed).toBe(true);
    expect(roster.players.map((player) => player.id)).toEqual([3]);
  });

  it("hittar inte på en trupp av andra statuskällor", () => {
    const roster = selectMatchRoster(11, false, []);
    expect(roster.source).toBe("none");
    expect(roster.players).toEqual([]);
  });

  it("använder faktiska deltagare som facit efter spelad match", () => {
    const roster = selectMatchRoster(13, true, [
      candidate(13, 1, "confirmed"),
      candidate(13, 2, "played"),
      candidate(13, 2, "played"),
    ]);
    expect(roster.source).toBe("played");
    expect(roster.label).toBe("Deltog");
    expect(roster.players.map((player) => player.id)).toEqual([2]);
  });

  it("blandar inte in andra matcher och hittar inte på en trupp när underlag saknas", () => {
    const roster = selectMatchRoster(14, false, [candidate(99, 1, "confirmed")]);
    expect(roster.source).toBe("none");
    expect(roster.players).toEqual([]);
  });
});
