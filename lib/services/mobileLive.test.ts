import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseMobileLiveAction } from "./mobileLive";

describe("parseMobileLiveAction", () => {
  it("accepterar matchcentrets giltiga kommandon", () => {
    expect(parseMobileLiveAction({ type: "clock", op: "start" })).toEqual({ type: "clock", op: "start" });
    expect(parseMobileLiveAction({ type: "goal", playerId: 7, idempotencyKey: "goal-key-123" })).toEqual({
      type: "goal",
      playerId: 7,
      idempotencyKey: "goal-key-123",
    });
    expect(parseMobileLiveAction({ type: "opponent_goal", idempotencyKey: "opp-key-123" })).toEqual({
      type: "opponent_goal",
      idempotencyKey: "opp-key-123",
    });
    expect(parseMobileLiveAction({ type: "undo" })).toEqual({ type: "undo" });
  });

  it("avvisar ogiltiga klockoperationer och målkommandon", () => {
    expect(() => parseMobileLiveAction({ type: "clock", op: "finish" })).toThrow("Ogiltig klockåtgärd");
    expect(() => parseMobileLiveAction({ type: "goal", playerId: 0, idempotencyKey: "goal-key-123" })).toThrow("Ogiltig målskytt");
    expect(() => parseMobileLiveAction({ type: "opponent_goal", idempotencyKey: "kort" })).toThrow("Ogiltig idempotensnyckel");
  });
});
