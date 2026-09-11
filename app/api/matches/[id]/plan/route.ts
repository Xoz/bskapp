import type { NextRequest } from 'next/server';
import { requestOrigin } from '../../../../../lib/auth';
import { saveMatchPlan } from '../../../../../lib/matchPlan/actions';

// En fast adress överlever nya byggen medan sidan är öppen.
// Samma servervalidering och revisionskontroll som den tidigare Server Action.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (request.headers.get('origin') !== requestOrigin(request))
    return Response.json({ error: 'Sparandet måste göras från appen.' }, { status: 403 });
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
    return Response.json({ error: 'Ogiltigt format för matchplanen.' }, { status: 415 });
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Kunde inte läsa matchplanen.' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return Response.json({ error: 'Kunde inte läsa matchplanen.' }, { status: 400 });
  const { id } = await params;
  const result = await saveMatchPlan(Number(id), body.revision, body.document);
  return Response.json(result, { status: result.error ? 400 : 200, headers: { 'Cache-Control': 'no-store' } });
}
