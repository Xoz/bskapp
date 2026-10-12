import type { NextRequest } from 'next/server';
import { requestOrigin } from '../../../../lib/auth';
import { readDesktopEditor, writeDesktopEditor } from '../../../../lib/desktop/editor';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
export async function GET(request: NextRequest) {
  const result = await readDesktopEditor(request.nextUrl.searchParams.get('kind') || '', request.nextUrl.searchParams.get('id') || '');
  return Response.json(result.body, { status: result.status, headers });
}
export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== requestOrigin(request)) return Response.json({ error: 'Sparandet måste göras från appen.' }, { status: 403, headers });
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return Response.json({ error: 'Ogiltigt format.' }, { status: 415, headers });
  const text = await request.text();
  if (Buffer.byteLength(text) > 1_100_000) return Response.json({ error: 'Underlaget är för stort.' }, { status: 413, headers });
  let body;
  try { body = JSON.parse(text); } catch { return Response.json({ error: 'Kunde inte läsa underlaget.' }, { status: 400, headers }); }
  const result = await writeDesktopEditor(body);
  return Response.json(result.body, { status: result.status, headers });
}
