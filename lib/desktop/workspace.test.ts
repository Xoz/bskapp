import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ user: vi.fn(), all: vi.fn(), matches: vi.fn(), groups: vi.fn(), evaluation: vi.fn() }));
vi.mock('../auth', () => ({ getCurrentUser: mocks.user, isStaffRole: (role: string) => ['admin','head_coach','coach','leader'].includes(role) }));
vi.mock('../db', () => ({ all: mocks.all }));
vi.mock('../queries', () => ({ getMatches: mocks.matches }));
vi.mock('../organization', () => ({ getOrganizationGroups: mocks.groups }));
vi.mock('../matchEvaluation', () => ({ getMatchEvaluationStatus: mocks.evaluation, matchEvaluationIsOpen: () => false }));
vi.mock('../dates', () => ({ swedishToday: () => '2026-10-12' }));
import { desktopWorkspace } from './workspace';
import { GET } from '../../app/api/desktop/workspace/route';
const user = { id: 1, primaryRole: 'coach', permissions: ['view_matches', 'manage_squads', 'manage_evaluations', 'view_players'] };
beforeEach(() => {
  vi.clearAllMocks(); mocks.user.mockResolvedValue(user); mocks.all.mockResolvedValue([]);
  mocks.groups.mockResolvedValue([{ id: 1, name: 'Gul' }]);
  mocks.matches.mockResolvedValue([{ id: 9, date: '2026-10-13', start_time: null, opponent: 'QA', home_away: 'home', finished: 0, cancelled: 0, group_id: 1 }]);
});
describe('Mac läsrouter', () => {
  it('nekar utan session före dataläsning', async () => {
    mocks.user.mockResolvedValue(null); expect((await desktopWorkspace()).status).toBe(401); expect(mocks.matches).not.toHaveBeenCalled();
  });
  it('nekar föräldrar och personal utan matchbehörighet', async () => {
    for (const candidate of [{ ...user, primaryRole: 'parent' }, { ...user, permissions: [] }]) {
      mocks.user.mockResolvedValue(candidate); expect((await desktopWorkspace()).status).toBe(403);
    }
    expect(mocks.all).not.toHaveBeenCalled();
  });
  it('kan inte kringgå getMatches gruppfilter med begärt match-id', async () => {
    const result = await desktopWorkspace(123);
    expect(result.status).toBe(200); expect('matches' in result.body && result.body.matches?.map(m => m.id)).toEqual([9]);
    for (const [query, args] of mocks.all.mock.calls) { expect(query.trim()).toMatch(/^SELECT/); expect(args).not.toContain(123); }
  });
  it('läser enbart personliga träningspass och döljer dem utan behörighet', async () => {
    await desktopWorkspace(); expect(mocks.all.mock.calls.find(([sql]) => sql.includes('training_plans'))?.[1]).toEqual([1]);
    mocks.all.mockClear(); mocks.user.mockResolvedValue({ ...user, permissions: ['view_matches'] });
    await desktopWorkspace(); expect(mocks.all.mock.calls.some(([sql]) => sql.includes('training_plans'))).toBe(false);
  });
  it('begränsar antalet kommande matcher', async () => {
    mocks.matches.mockResolvedValue(Array.from({ length: 100 }, (_, i) => ({ id: i+1, date: '2026-10-13', opponent: 'QA', home_away: 'home' })));
    const result = await desktopWorkspace(); expect('matches' in result.body && result.body.matches?.length).toBe(20);
  });
  it('validerar id och skickar privat no-store', async () => {
    expect((await GET(new Request('http://localhost/api/desktop/workspace?match=-1'))).status).toBe(400);
    const response = await GET(new Request('http://localhost/api/desktop/workspace'));
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(response.headers.get('vary')).toBe('Cookie');
  });
});
