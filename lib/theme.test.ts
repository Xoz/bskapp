import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { readThemePreference, resolveTheme, THEME_INIT_SCRIPT, THEME_COLORS } from "./theme";

describe("webbens tema", () => {
  it("väljer ljust som standard och respekterar explicita val", () => {
    expect(readThemePreference(null)).toBe("light");
    expect(readThemePreference("invalid")).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
  it.each(["light", "dark", "system", "blocked"])("initierar %s före hydrering utan lagringskrav", (preference) => {
    const dataset: Record<string, string> = {};
    let themeColor = "";
    runInNewContext(THEME_INIT_SCRIPT, {
      localStorage: { getItem: () => { if (preference === "blocked") throw new Error("blocked"); return preference; } },
      window: { matchMedia: () => ({ matches: true }) },
      document: { documentElement: { dataset }, querySelector: () => ({ setAttribute: (_name: string, value: string) => { themeColor = value; } }) },
    });
    const expected = preference === "dark" || preference === "system" ? "dark" : "light";
    expect(dataset.theme).toBe(expected);
    expect(themeColor).toBe(THEME_COLORS[expected]);
  });
});
