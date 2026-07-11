import { describe, expect, it } from "vitest";
import { attendanceSchema, seasonPeriodSchema } from "./domain";

describe("domain validation", () => {
  it("avvisar en omvänd säsongsperiod", () => expect(seasonPeriodSchema.safeParse({ id:"p", name:"Period", startsOn:"2026-02-01", endsOn:"2026-01-01", theme:"Tema", skillIds:[] }).success).toBe(false));
  it("accepterar endast kända närvarostatusar", () => { expect(attendanceSchema.safeParse({ playerId:"p", status:"present" }).success).toBe(true); expect(attendanceSchema.safeParse({ playerId:"p", status:"unknown" }).success).toBe(false); });
});
