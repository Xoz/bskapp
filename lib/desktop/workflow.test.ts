import { describe, it, expect } from 'vitest';
import { workflowMatch } from './workflow';
import type { Match } from '../queries';
const match = { id: 9, date: '2026-10-13', start_time: '18:00', opponent: 'QA Motstånd', home_away: 'home', finished: 0, location: 'QA Plan' } as Match;
const input = { match, today: '2026-10-12', team: 'Gul', planSaved: false, selected: 0, accepted: 4, evaluation: { total: 0, evaluated: 0 }, evaluationOpen: false, canSelect: true, canEvaluate: true, canPlayers: true };
describe('Mac arbetsflöde', () => {
  it('prioriterar uttagning utan att tolka ja-svar som uttagning', () => {
    const result = workflowMatch(input);
    expect(result.stage).toBe('prepare'); expect(result.next.path).toBe('/matcher/9/laguttagning');
    expect(result.selected).toBe(0); expect(result.accepted).toBe(4);
  });
  it('tar nästa steg till matchplanen efter uttagning', () => {
    expect(workflowMatch({ ...input, selected: 7 }).next.path).toBe('/matcher/9#matchplan');
  });
  it('erbjuder plan och trupp under matchdagen', () => {
    const result = workflowMatch({ ...input, today: match.date });
    expect(result.stage).toBe('perform'); expect(result.actions.perform.map(a => a.path)).toEqual(['/matcher/9#matchplan', '/matcher/9#trupp']);
  });
  it('prioriterar uppföljning efter matchen utan att använda resultat som bevis', () => {
    const result = workflowMatch({ ...input, today: '2026-10-14', evaluationOpen: true, evaluation: { total: 7, evaluated: 2 } });
    expect(result.stage).toBe('review'); expect(result.next.path).toBe('/matcher/9/utvardera'); expect(result.evaluated).toBe(2);
  });
  it('respekterar behörighet, lag och tidsgräns för utvärdering', () => {
    for (const change of [{ canEvaluate: false }, { team: 'Grön' }, { evaluationOpen: false }]) {
      expect(workflowMatch({ ...input, evaluationOpen: true, ...change }).actions.review.some(a => a.path.endsWith('utvardera'))).toBe(false);
    }
    const result = workflowMatch({ ...input, canSelect: false, canEvaluate: false, canPlayers: false });
    expect(result.actions.prepare).toHaveLength(1); expect(result.actions.review).toHaveLength(1);
  });
  it('återger bara arbetsflödesdata, inga matchtoken eller spelaruppgifter', () => {
    const result = workflowMatch({ ...input, match: { ...match, report_token: 'secret', code: 'secret', notes: 'private' } });
    expect(JSON.stringify(result)).not.toContain('secret'); expect(JSON.stringify(result)).not.toContain('private');
  });
});
