import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('../auth', () => ({ requestOrigin: (req: Request) => {
  const proto = req.headers.get('x-forwarded-proto');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  return proto && host ? `${proto}://${host}` : new URL(req.url).origin;
} }));
vi.mock('./actions', () => ({ saveMatchPlan: vi.fn() }));
import { POST } from '../../app/api/matches/[id]/plan/route';
import { saveMatchPlan } from './actions';
import { persistMatchPlan } from './client';
import { emptyMatchPlan } from './model';
const document = emptyMatchPlan();
const context = { params: Promise.resolve({ id: '7' }) };
function request(body: string, origin = 'https://bsk2014.se', contentType = 'application/json') {
  return new NextRequest('http://localhost:3001/api/matches/7/plan', { method: 'POST', body,
    headers: { origin, 'content-type': contentType, 'x-forwarded-proto': 'https', 'x-forwarded-host': 'bsk2014.se' } });
}
beforeEach(() => { vi.mocked(saveMatchPlan).mockReset().mockResolvedValue({ revision: 3 }); });
afterEach(() => vi.unstubAllGlobals());
describe('matchplanens fasta sparadress', () => {
  it('bevarar planen och revisionen genom klient, proxy och server', async () => {
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe('/api/matches/7/plan');
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
      return POST(request(init.body as string), context);
    });
    vi.stubGlobal('fetch', fetchMock);
    expect(await persistMatchPlan(7, 2, document)).toEqual({ revision: 3 });
    expect(saveMatchPlan).toHaveBeenCalledWith(7, 2, document);
  });
  it('avvisar främmande/saknad origin och formulär före skrivning', async () => {
    const body = JSON.stringify({ revision: 2, document });
    expect((await POST(request(body, 'https://annan.se'), context)).status).toBe(403);
    expect((await POST(request(body, ''), context)).status).toBe(403);
    expect((await POST(request(body, 'https://bsk2014.se', 'text/plain'), context)).status).toBe(415);
    expect(saveMatchPlan).not.toHaveBeenCalled();
  });
  it('avvisar trasig JSON och null före skrivning', async () => {
    expect((await POST(request('{'), context)).status).toBe(400);
    expect((await POST(request('null'), context)).status).toBe(400);
    expect(saveMatchPlan).not.toHaveBeenCalled();
  });
  it('visar serverns konflikt/behörighetsfel utan falsk sparbekräftelse', async () => {
    vi.mocked(saveMatchPlan).mockResolvedValue({ error: 'Planen har ändrats.' });
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => POST(request(init.body as string), context));
    expect(await persistMatchPlan(7, 2, document)).toEqual({ error: 'Planen har ändrats.' });
  });
  it('bekräftar inte nätfel, HTML-svar eller fel revision som sparade', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(persistMatchPlan(7, 2, document)).rejects.toThrow();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Login</html>')));
    await expect(persistMatchPlan(7, 2, document)).rejects.toThrow();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ revision: 2 })));
    await expect(persistMatchPlan(7, 2, document)).rejects.toThrow();
  });
});
