import { describe, expect, it } from "vitest";
import { shouldCloseMatchFollowup } from "./matchFollowup";

const answer = (playerId: number, handled: boolean) => ({
  playerId,
  selfComparison: handled ? "usual" : null,
  matchImpact: handled ? "held" : null,
  skipped: false,
});

describe("matchuppföljning", () => {
  it("stänger när alla spelare har bedömts eller hoppats över", () => {
    expect(shouldCloseMatchFollowup(
      [1, 2],
      [answer(1, true)],
      [{ ...answer(2, false), skipped: true }],
      false
    )).toBe(true);
  });

  it("hålls öppen när en spelarbedömning återstår", () => {
    expect(shouldCloseMatchFollowup([1, 2], [answer(1, true)], [], false)).toBe(false);
  });

  it("kan avslutas uttryckligen utan spelarbedömningar", () => {
    expect(shouldCloseMatchFollowup([1, 2], [], [], true)).toBe(true);
    expect(shouldCloseMatchFollowup([], [], [], true)).toBe(true);
  });
});
