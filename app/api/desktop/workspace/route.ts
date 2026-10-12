import { desktopWorkspace } from '../../../../lib/desktop/workspace';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('match');
  const id = raw === null ? undefined : Number(raw);
  if (id !== undefined && (!Number.isSafeInteger(id) || id < 1))
    return Response.json({ error: 'Ogiltig match.' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } });
  const result = await desktopWorkspace(id);
  return Response.json(result.body, { status: result.status, headers: { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' } });
}
