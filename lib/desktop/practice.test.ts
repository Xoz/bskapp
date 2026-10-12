import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ user: vi.fn(), all: vi.fn(), players: vi.fn() }));
vi.mock('../auth', () => ({ getCurrentUser: m.user, isStaffRole: (r: string) => r === 'coach' }));
vi.mock('../db', () => ({ all: m.all }));
vi.mock('../queries', () => ({ getPlayers: m.players }));
import { desktopPractice } from './practice';
import { GET } from '../../app/api/desktop/practice/route';
const user = { id: 7, primaryRole: 'coach', permissions: ['view_players', 'manage_evaluations', 'view_private_player_data'] };
beforeEach(() => { vi.clearAllMocks(); m.user.mockResolvedValue(user); m.all.mockResolvedValue([]); m.players.mockResolvedValue([{ id: 3, name: 'QA', notes: 'PRIVATE', share_token: 'SECRET' }]); });
it('requires staff session before any data read', async () => {
  for (const u of [null, { ...user, primaryRole: 'parent' }, { ...user, permissions: [] }]) {
    m.user.mockResolvedValue(u); expect((await desktopPractice()).status).not.toBe(200);
  }
  expect(m.all).not.toHaveBeenCalled(); expect(m.players).not.toHaveBeenCalled();
});
it('reads only owned valid plans and returns no drawings or private player fields', async () => {
  m.all.mockImplementation(async (sql: string) => sql.includes('training_plans') ? [
    { id: 'qa', document: { version: 1, title: 'QA pass', date: '', blocks: [] } }, { id: 'bad', document: null },
  ] : [{ id: 3, checkpoint: '2026-01-01', conversation: null, followup: null }]);
  const r = await desktopPractice();
  expect(m.all.mock.calls[0][1]).toEqual([7]);
  expect(m.all.mock.calls[1][1]).toEqual([3]);
  expect(JSON.stringify(r.body)).not.toMatch(/PRIVATE|SECRET|bad/);
  expect('plans' in r.body && r.body.plans).toHaveLength(1);
  for (const [sql] of m.all.mock.calls) expect(sql.trim()).toMatch(/^SELECT/);
});
it('does not query private dates or training without permissions', async () => {
  m.user.mockResolvedValue({ ...user, permissions: ['view_players'] });
  const r = await desktopPractice();
  expect(m.all).not.toHaveBeenCalled();
  expect('canEdit' in r.body && r.body.canEdit).toBe(false);
  expect('players' in r.body && r.body.players?.[0]).toEqual({ id: 3, name: 'QA', checkpoint: null, conversation: null, followup: null });
});
it('supports training without players permission and never reads player data', async () => {
  m.user.mockResolvedValue({ ...user, permissions: ['manage_evaluations'] });
  expect((await desktopPractice()).status).toBe(200); expect(m.players).not.toHaveBeenCalled();
});
it('makes responses private and uncacheable', async () => {
  const r = await GET(); expect(r.headers.get('cache-control')).toBe('private, no-store'); expect(r.headers.get('vary')).toBe('Cookie');
});
