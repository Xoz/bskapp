import { describe, it, expect } from 'vitest';
import { assessMatchLevel, ratingStatement, type RatingEvidence } from './matchRating';
const today = '2026-09-11';
const matches = (count: number, match_level = 'latt', rating = 5): RatingEvidence[] => Array.from({length: count}, (_, match_id) => ({match_id, match_level, rating, date: today}));
describe('matchpoäng som nivåunderlag', () => {
  it('höga poäng på lätt etablerar bara lätt och föreslår medel', () => {
    const result = assessMatchLevel(matches(20), today);
    expect(result.established?.id).toBe('latt'); expect(result.challenge?.id).toBe('medel');
  });
  it('kräver fem unika matcher, inte fem bedömare', () => {
    expect(assessMatchLevel(matches(4, 'extra_svar'), today).established).toBeNull();
    expect(assessMatchLevel(Array(8).fill(matches(1)[0]), today).established).toBeNull();
    expect(assessMatchLevel(matches(5, '1'), today).established?.id).toBe('extra_svar');
    expect(assessMatchLevel(matches(5, '1'), today).challenge).toBeNull();
  });
  it('snitt 3 etablerar nivån men föreslår ingen uppflyttning', () => {
    const result = assessMatchLevel(matches(5,'svar',3),today);
    expect(result.established?.id).toBe('svar'); expect(result.challenge).toBeNull();
    expect(assessMatchLevel(matches(5,'svar',2),today).established).toBeNull();
  });
  it('saknad nivå, äldre skala, framtid och över 180 dagar ger inte nivå', () => {
    const rows = [...matches(5,''), ...matches(5,'svar').map(r=>({...r,rating:null})), ...matches(5,'svar').map(r=>({...r,date:'2025-01-01'})), ...matches(5,'svar').map(r=>({...r,date:'2026-09-12'}))];
    const result = assessMatchLevel(rows,today); expect(result.established).toBeNull(); expect(result.unknown).toBe(5);
  });
  it('senaste matcher väger mer och bedömare delar matchens vikt', () => {
    const rows=[...matches(4,'medel',5).map(r=>({...r,date:'2026-07-13'})), {match_id:8,match_level:'medel',rating:1,date:today}];
    const result=assessMatchLevel(rows,today); expect(result.levels[2].average).toBeCloseTo(11/3);
    const duplicate=assessMatchLevel([...rows,rows[4]],today); expect(duplicate.levels[2].average).toBeCloseTo(result.levels[2].average!);
  });
  it('avvisar felaktiga poäng och långa kommentarer', () => {
    for(const value of [0,6,2.5,NaN,Infinity]) expect(()=>ratingStatement(1,2,'coach','3',value,'','latt')).toThrow();
    expect(()=>ratingStatement(1,2,'coach','3',3,'x'.repeat(1001),'latt')).toThrow();
    expect(ratingStatement(1,2,'coach','3',null,'','4').args.slice(-2)).toEqual(['latt',1]);
  });
});
