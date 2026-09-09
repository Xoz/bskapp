import { describe, expect, it } from "vitest";
import { filterNavItems, isActive } from "./nav";

describe("unified navigation", () => {
  it("keeps match work in one area on desktop and mobile", () => {
    const permissions = ["view_players", "manage_evaluations", "manage_squads"] as const;
    expect(filterNavItems([...permissions]).map((item) => item.label)).toEqual(["Idag", "Spelare", "Matcher", "Träning"]);
    expect(filterNavItems([...permissions], true)).toEqual(filterNavItems([...permissions]));
    for (const path of ["/matcher/12", "/matcher/12/laguttagning", "/matcher/12/utvardera", "/uttagning", "/observera"]) expect(isActive(path, "/matcher")).toBe(true);
    expect(isActive("/matcher-annan", "/matcher")).toBe(false);
  });
  it("does not expose restricted workspaces without permission", () => {
    expect(filterNavItems([]).map((item) => item.href)).toEqual(["/idag", "/matcher"]);
  });
});
