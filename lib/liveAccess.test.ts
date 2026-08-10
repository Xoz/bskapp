import { describe, expect, it } from "vitest";
import { hasReportingCapability } from "./liveAccess";

describe("hasReportingCapability", () => {
  const token = "u4p8dKQ1y2v9N7x5m3B6c0R8s2T4w6Z9";

  it("godkänner endast exakt matchspecifik token", () => {
    expect(hasReportingCapability(token, token)).toBe(true);
    expect(hasReportingCapability(`${token}x`, token)).toBe(false);
    expect(hasReportingCapability(token.replace("u", "v"), token)).toBe(false);
  });

  it("avvisar saknade och för korta tokens", () => {
    expect(hasReportingCapability(undefined, token)).toBe(false);
    expect(hasReportingCapability(token, null)).toBe(false);
    expect(hasReportingCapability("kort", "kort")).toBe(false);
  });
});
