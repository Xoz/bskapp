import { describe, expect, it } from "vitest";
import { SKILLS } from "./skillTrappan";

describe("utvecklingsträdets tränarbedömningar", () => {
  it("formulerar alla punkter som påståenden för tränaren", () => {
    expect(SKILLS).toHaveLength(84);
    expect(SKILLS.find((skill) => skill.id === "bollkontroll-3")?.question).toBe(
      "Kan driva bollen 10 meter med många små touch."
    );

    for (const skill of SKILLS) {
      expect(skill.question).not.toContain("?");
      expect(skill.question).not.toMatch(/\b(du|dig|din|ditt|dina)\b/i);
    }
  });
});
