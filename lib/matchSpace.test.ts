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
      expect(result.current).toBe(capacity - 45);
    }
  });
  it("återhämtar 20 per vilodygn från aktivitetens slut och aldrig över taket", () => {
    const result = forecastMatchSpace({capacity: 100, now: now + day + 3600000, events: [match("a", now)]});
    expect(result.current).toBe(75);
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
    expect(result.current).toBe(100); expect(result.before).toBe(100); expect(result.after).toBe(55);
  });
  it("kontrollerar efterföljande match och uppdaterar prognosen vid kortare speltid", () => {
    const target = match("lån", now, {planned:true});
    const input = {capacity:80, now, target, events:[match("egen", now+2*3600000,{planned:true})]};
    const full = forecastMatchSpace(input);
    expect(full.level).toBe("high"); expect(full.nextAffected).toBe("egen");
    const short = forecastMatchSpace(input, 20);
    expect(short.lowest).toBeGreaterThan(full.lowest); expect(short.lowest).toBeGreaterThan(full.lowest);
  });
  it("varnar vid tidskrock trots stort batteri", () => {
    const target = match("lån",now,{planned:true});
    const input = {capacity:150,now,target,events:[match("egen",now+30*60000,{planned:true})]};
    expect(forecastMatchSpace(input).conflict).toBe(true);
    expect(forecastMatchSpace(input).level).toBe("high");
    expect(forecastMatchSpace(input,0).conflict).toBe(false);
  });
  it("räknar träning och bevarar skuld under noll", () => {
    const events = Array.from({length:5}, (_,i)=>match(String(i), now+i*3600000));
    expect(forecastMatchSpace({capacity:100,now:now+5*3600000+day,events}).current).toBe(0);
    expect(forecastMatchSpace({capacity:100,now,events:[match("träning",now,{kind:"training"})]}).current).toBe(85);
  });
  it("använder verklig tid över svensk sommartidsgräns", () => {
    const start = swedishWallClockToEpoch("2026-03-28","12:00");
    const end = swedishWallClockToEpoch("2026-03-29","12:00");
    expect(end-start).toBe(23*3600000);
    expect(forecastMatchSpace({capacity:100,now:end,events:[match("a",start)]}).current).toBe(73);
  });
  it("markerar tom historik som uppskattning", () => {
    expect(forecastMatchSpace({capacity:100,now,events:[]}).estimated).toBe(true);
  });
});

// Kalibrering: tre träningar och två 7v7-matcher med nio spelare.
it("normal vecka med lördags- och söndagsmatch slutar runt 50 procent", () => {
  const at=(date:string,time:string)=>swedishWallClockToEpoch(date,time);
  const training=['2026-09-14','2026-09-16','2026-09-18'].map((d,i)=>match(`t:${i}`,at(d,'18:00'),{kind:'training',planned:true}));
  const first=match('lördag',at('2026-09-19','12:00'),{minutes:45,planned:true});
  const second=match('söndag',at('2026-09-20','12:00'),{minutes:45,planned:true});
  const result=forecastMatchSpace({capacity:100,now:at('2026-09-14','09:00'),events:[...training,first],target:second});
  expect(result.after).toBe(51);
  expect(result.level).toBe('normal');
  const tight=forecastMatchSpace({capacity:100,now:first.start,events:[...training,first],target:{...second,start:first.start+75*60000}});
  expect(tight.lowest).toBeLessThan(result.lowest);
});
it('under 50 varnar men exakt 50 gör det inte',()=>{
 const target=match('m',now,{minutes:40,planned:true}); // 30 poäng.
 const prior=match('t',now-80*60000,{kind:'training',duration:80,minutes:80}); // 20 poäng, ingen återhämtning emellan.
 expect(forecastMatchSpace({capacity:100,now,events:[prior],target}).level).toBe('normal');
 const low=forecastMatchSpace({capacity:100,now,events:[prior],target:{...target,minutes:40.1}});
 expect(low.lowestRatio).toBeLessThan(0.5);
 expect(low.level).toBe('maximum');
});
it('matchkostnaden ökar bara under 50, även vid passage mitt i matchen',()=>{
 const training=match('t',now-160*60000,{kind:'training',duration:160,minutes:160}); // Startar på 60.
 const target=match('m',now,{minutes:40,planned:true}); // Linjärt skulle slutet vara 30.
 const combined=forecastMatchSpace({capacity:100,now,events:[training],target});
 expect(combined.after).toBeLessThan(30);
 const first=match('m1',now,{duration:20,minutes:20});
 const second=match('m2',now+20*60000,{duration:20,minutes:20});
 const split=forecastMatchSpace({capacity:100,now,events:[training,first],target:second});
 expect(split.after).toBe(combined.after);
 // Faktisk laddning och prognos använder samma olinjära beräkning.
 expect(forecastMatchSpace({capacity:100,now,events:[training,{...target,planned:false}]}).current).toBe(combined.after);
});

it('extra matchkostnad är begränsad till 50 procent även vid skuld',()=>{
 const training=match('t',now-400*60000,{kind:'training',duration:400,minutes:400});
 const result=forecastMatchSpace({capacity:100,now,events:[training],target:match('m',now,{minutes:20,planned:true})});
 expect(result.lowestRatio).toBeCloseTo(-0.225);
 expect(result.after).toBe(0);
});
it('träning räknas även under 50 men får ingen extra matchkostnad',()=>{
 const prior=match('t1',now-300*60000,{kind:'training',duration:300,minutes:300});
 const result=forecastMatchSpace({capacity:100,now,events:[prior],target:match('t2',now,{kind:'training',minutes:20,planned:true})});
 expect(result.after).toBe(20);
});
