import { describe, expect, it } from "vitest";
import { selectionPositionRank } from "./positions";

describe("uttagningens positionsordning", () => {
  it("sorterar målvakt, back, mittfält, anfall och osatt", () => {
    const players = [
      { name: "Osatt", primary: "", fallback: "" },
      { name: "Anfall", primary: "Anfall", fallback: "" },
      { name: "Kant", primary: "Vänsterkant", fallback: "" },
      { name: "Back", primary: "Back", fallback: "" },
      { name: "Målvakt", primary: "Målvakt", fallback: "" },
    ];

    expect(players.sort((left, right) =>
      selectionPositionRank(left.primary, left.fallback) - selectionPositionRank(right.primary, right.fallback)
    ).map((player) => player.name)).toEqual(["Målvakt", "Back", "Kant", "Anfall", "Osatt"]);
  });

  it("använder spelarens äldre position när förstaposition saknas", () => {
    expect(selectionPositionRank("", "forsvar")).toBe(1);
    expect(selectionPositionRank("", "mittfalt")).toBe(2);
  });
});
