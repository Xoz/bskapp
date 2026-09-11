import { describe, it, expect } from "vitest";
import { forecastMatchSpace, type SpaceEvent } from "./matchSpace";
import { swedishWallClockToEpoch } from "./dates";
const day = 86400000;
const now = Date.parse("2026-09-10T10:00:00Z");
const match = (id: string, start: number, extra: Partial<SpaceEvent> = {}): SpaceEvent => ({id, start, title: id, duration: 60, minutes: 60, kind: "match", planned: false, estimated: false, ...extra});

describe("individuellt matchutrymme", () => {
  it("skiljer kapacitet från aktuell laddning och använder samma kostnad", () => {
    for (const capacity of [80, 100, 125]) {
      const result = forecastMatchSpace({capacity, now, events: [match("a", now)]});
      expect(result.current).toBe(capacity - 6);
    }
  });
  it("återhämtar 20 per vilodygn från aktivitetens slut och aldrig över taket", () => {
    const result = forecastMatchSpace({capacity: 100, now: now + day + 5*3600000, events: [match("a", now, {duration:300,minutes:300})]});
    expect(result.current).toBe(90);
    expect(forecastMatchSpace({capacity: 80, now: now + 5*day, events: [match("a", now)]}).current).toBe(80);
  });
  it("skiljer täta matcher från samma antal utspridda matcher", () => {
    const tight = forecastMatchSpace({capacity: 100, now, events: [match("a", now-day), match("b", now-2*3600000)], target: match("c", now, {planned:true})});
    const spread = forecastMatchSpace({capacity: 100, now, events: [match("a", now-6*day), match("b", now-3*day)], target: match("c", now, {planned:true})});
    expect(tight.lowest).toBeLessThan(spread.lowest); expect(spread.level).toBe("normal");
  });
  it("påverkar inte dagens batteri med framtida matcher, och räknar målmatchen en gång", () => {
    const target = match("target", now+day, {planned:true});
    const result = forecastMatchSpace({capacity:100, now, events:[target, target], target});
    expect(result.current).toBe(100); expect(result.before).toBe(100); expect(result.after).toBe(94);
  });
  it("kontrollerar efterföljande match och uppdaterar prognosen vid kortare speltid", () => {
    const target = match("lån", now, {planned:true});
    const input = {capacity:80, now, target, events:[match("egen", now+2*3600000,{planned:true})]};
    const full = forecastMatchSpace(input);
    expect(full.level).toBe("normal"); expect(full.lowest).toBeLessThan(full.after);
    const short = forecastMatchSpace(input, 20);
    expect(short.lowest).toBeGreaterThan(full.lowest); expect(short.level).toBe("normal");
  });
  it("varnar vid tidskrock trots stort batteri", () => {
    const target = match("lån",now,{planned:true});
    const input = {capacity:150,now,target,events:[match("egen",now+30*60000,{planned:true})]};
    expect(forecastMatchSpace(input).conflict).toBe(true);
    expect(forecastMatchSpace(input).level).toBe("high");
    expect(forecastMatchSpace(input,0).conflict).toBe(false);
  });
  it("räknar träning och bevarar skuld under noll", () => {
    const events = Array.from({length:30}, (_,i)=>match(String(i), now+i*3600000));
    expect(forecastMatchSpace({capacity:100,now:now+30*3600000+day,events}).current).toBe(0);
    expect(forecastMatchSpace({capacity:100,now,events:[match("träning",now,{kind:"training"})]}).current).toBe(97);
  });
  it("använder verklig tid över svensk sommartidsgräns", () => {
    const start = swedishWallClockToEpoch("2026-03-28","12:00");
    const end = swedishWallClockToEpoch("2026-03-29","12:00");
    expect(end-start).toBe(23*3600000);
    expect(forecastMatchSpace({capacity:100,now:end,events:[match("a",start,{duration:300,minutes:300})]}).current).toBe(85);
  });
  it("markerar tom historik som uppskattning", () => {
    expect(forecastMatchSpace({capacity:100,now,events:[]}).estimated).toBe(true);
  });
});

// Ordinarie vecka, även med full målvaktstid och minsta tillåtna kapacitet.
it("träningar och två fulla matcher samma dag ger inga batterivarningar", () => {
  for (let capacity = 50; capacity <= 150; capacity++) {
    const training = [-4, -2, 0].map((d, i) => match(`träning:${i}`, now + d*day, {kind:"training", duration:60, minutes:60, planned:true}));
    const first = match("första", now+2*3600000, {duration:75,minutes:75,planned:true});
    const second = match("andra", now+3.5*3600000, {duration:75,minutes:75,planned:true});
    const forecast = forecastMatchSpace({capacity,now,events:[...training,first,second],target:first});
    expect(forecast.conflict).toBe(false);
    expect(forecast.level).toBe("normal");
    expect(forecast.lowestRatio).toBeGreaterThanOrEqual(0.6);
  }
});
