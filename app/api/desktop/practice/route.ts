import { desktopPractice } from '../../../../lib/desktop/practice';
export const dynamic = 'force-dynamic';
export async function GET() {
  const result = await desktopPractice();
  return Response.json(result.body, { status: result.status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
}
