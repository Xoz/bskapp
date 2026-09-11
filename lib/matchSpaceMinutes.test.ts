import { describe, expect, it } from "vitest";
import { matchSpaceGoalkeeper, sharedMatchMinutes, type MatchSpaceParticipant } from "./matchSpaceMinutes";
import { emptyMatchPlan } from "./matchPlan/model";
const player = (id:number, primary="", selected=""): MatchSpaceParticipant => ({player_id:id,preferred_position_primary:primary,selected_position:selected,attendance_position:null,position:null});
describe("jämn fördelning av speltid",()=>{
  it.each([[8,360/7],[9,45],[10,40]])("7v7 med %i deltagare",(n,minutes)=>{
    expect(sharedMatchMinutes(60,n,false)).toBeCloseTo(minutes);
    expect(sharedMatchMinutes(60,n,true)).toBe(60);
    expect(sharedMatchMinutes(60,n,false)*(n-1)+60).toBeCloseTo(420);
  });
  it.each([9,10,11,12])("9v9 med %i deltagare",n=>{
    expect(sharedMatchMinutes(75,n,false)).toBeCloseTo(600/(n-1));
    expect(sharedMatchMinutes(75,n,true)).toBe(75);
  });
  it("bevarar korta cupmatcher och ger aldrig mer än full matchtid",()=>{
    expect(sharedMatchMinutes(20,9,false)).toBe(15);
    for(const n of [0,1,2,6,7]) expect(sharedMatchMinutes(60,n,false)).toBe(60);
  });
  it("väljer matchposition före profil och markerar tvetydig målvakt",()=>{
    expect(matchSpaceGoalkeeper([player(1,'Målvakt'),player(2)])).toBe(1);
    expect(matchSpaceGoalkeeper([player(1,'Målvakt'),player(2,'Målvakt')])).toBeNull();
    expect(matchSpaceGoalkeeper([player(1,'Målvakt'),player(2,'','malvakt')])).toBe(2);
    expect(matchSpaceGoalkeeper([player(1,'Målvakt','forsvar'),player(2)])).toBeNull();
    const document=emptyMatchPlan();document.spots[0].playerId=2;document.spots[1].playerId=1;
    expect(matchSpaceGoalkeeper([player(1,'Målvakt'),player(2)],JSON.stringify({revision:1,document}))).toBe(2);
    expect(matchSpaceGoalkeeper([{...player(1),attendance_position:'Målvakt'},player(2)],JSON.stringify({revision:1,document}))).toBe(1);
  });
});
