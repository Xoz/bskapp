import { describe, expect, it } from "vitest";
import { validateSnapshot, sourceUrl, dayOffset, type ActivitySnapshot } from "./model";
const item = (): ActivitySnapshot => ({sourceId:"123",url:"https://www.svenskalag.se/bollstanassk-fotboll-f2014-gul/match/123/test",date:"2026-09-12",time:"09:00",title:"Testmatch",kind:"match",callups:[{name:"Exempel Spelare",status:"accepted"}],totals:{accepted:1,declined:0,pending:0},attendance:null});
describe("filfri Svenska Lag-synk",()=>{
  it("godtar komplett källa men inte tom eller ofullständig avläsning",()=>{
    expect(()=>validateSnapshot([item()],"2026-09-10")).not.toThrow();
    expect(()=>validateSnapshot([],"2026-09-10")).toThrow();
    const a=item();a.totals.accepted=2;
    expect(()=>validateSnapshot([a],"2026-09-10")).toThrow(/Ofullständig/);
  });
  it("avvisar dubbla personer och aktiviteter",()=>{
    const a=item();a.callups.push({...a.callups[0]});a.totals.accepted++;
    expect(()=>validateSnapshot([a],"2026-09-10")).toThrow();
    expect(()=>validateSnapshot([item(),item()],"2026-09-10")).toThrow();
  });
  it("gör inte framtida ja-svar till närvaro",()=>{
    const a=item();a.attendance=["Exempel Spelare"];
    expect(()=>validateSnapshot([a],"2026-09-10")).toThrow(/närvaro/);
  });
  it("begränsar läsning till Guls källa och rätt id",()=>{
    expect(()=>sourceUrl("https://evil.example/test")).toThrow();
    expect(()=>sourceUrl("https://www.svenskalag.se/annat-lag/match/123")).toThrow();
    const a=item();a.sourceId="456";
    expect(()=>validateSnapshot([a],"2026-09-10")).toThrow();
  });
  it("hanterar årsskifte i synkfönstret",()=>{
    expect(dayOffset("2027-01-02",-3)).toBe("2026-12-30");
    const a=item();a.date="2026-12-30";
    expect(()=>validateSnapshot([a],"2027-01-02")).not.toThrow();
  });
});
