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
  it("använder bekräftad trupp före preliminära källor på en kommande match", () => {
    const roster = selectMatchRoster(10, false, [
      candidate(10, 1, "accepted"),
      candidate(10, 2, "selection"),
      candidate(10, 3, "confirmed"),
    ]);
    expect(roster.source).toBe("confirmed");
    expect(roster.confirmed).toBe(true);
    expect(roster.players.map((player) => player.id)).toEqual([3]);
  });

  it("visar sparat uttagningsbeslut och därefter accepterade kallelser som preliminär trupp", () => {
    const selection = selectMatchRoster(11, false, [
      candidate(11, 1, "accepted"),
      candidate(11, 2, "selection"),
    ]);
    expect(selection.source).toBe("selection");
    expect(selection.label).toBe("Preliminär trupp");
    expect(selection.players.map((player) => player.id)).toEqual([2]);

    const accepted = selectMatchRoster(12, false, [candidate(12, 4, "accepted")]);
    expect(accepted.source).toBe("accepted");
    expect(accepted.players.map((player) => player.id)).toEqual([4]);
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
