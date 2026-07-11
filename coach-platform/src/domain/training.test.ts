import { describe, expect, it } from "vitest";
import { periodsOverlap, sessionFitsPlan, sessionMinutes } from "./training";
import type { SeasonPeriod, TrainingSession } from "./model";

const session: TrainingSession = { id:"s", teamId:"t", title:"Test", startsAt:"2026-01-01T10:00:00Z", theme:"Passning", plannedMinutes:30, status:"draft", blocks:[{ id:"b1", exerciseId:"e", title:"A", minutes:10, coachingPoints:[] }, { id:"b2", exerciseId:"e", title:"B", minutes:20, coachingPoints:[] }] };
const period = (id:string, startsOn:string, endsOn:string): SeasonPeriod => ({ id, name:id, startsOn, endsOn, theme:"Tema", skillIds:[] });

describe("training domain", () => {
  it("summerar block och upptäcker om passet passar planerad tid", () => { expect(sessionMinutes(session)).toBe(30); expect(sessionFitsPlan(session)).toBe(true); });
  it("upptäcker periodöverlapp inklusive gemensam gränsdag", () => { expect(periodsOverlap(period("a","2026-01-01","2026-01-10"), period("b","2026-01-10","2026-01-20"))).toBe(true); expect(periodsOverlap(period("a","2026-01-01","2026-01-09"), period("b","2026-01-10","2026-01-20"))).toBe(false); });
});
