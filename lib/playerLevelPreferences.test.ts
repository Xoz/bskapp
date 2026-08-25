import { describe, expect, it } from "vitest";
import { isValidChallengeLevel, normalizeChallengeLevel } from "./playerLevelPreferences";

describe("spelarens Sanktan-nivåer", () => {
  it("tillåter bara en utmaningsnivå som är svårare än normalnivån", () => {
    expect(isValidChallengeLevel("3", "2")).toBe(true);
    expect(isValidChallengeLevel("4", "3")).toBe(true);
    expect(isValidChallengeLevel("4", "2")).toBe(true);
    expect(isValidChallengeLevel("2", "3")).toBe(false);
    expect(isValidChallengeLevel("3", "4")).toBe(false);
    expect(isValidChallengeLevel("3", "3")).toBe(false);
  });

  it("rättar en omvänd eller fristående utmaningsnivå till ej satt", () => {
    expect(normalizeChallengeLevel("2", "3")).toBe("");
    expect(normalizeChallengeLevel("", "2")).toBe("");
    expect(normalizeChallengeLevel("3", "2")).toBe("2");
    expect(normalizeChallengeLevel("3", "")).toBe("");
  });
});
