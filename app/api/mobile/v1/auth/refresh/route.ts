import { refreshMobileSession } from "@/lib/mobileAuth";
import { mobileResponse } from "@/lib/mobileApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { refreshToken?: unknown } | null;
  if (typeof body?.refreshToken !== "string") {
    return Response.json({ apiVersion: "1", error: { code: "invalid_refresh", message: "Refresh-token saknas." } }, { status: 400 });
  }
  const tokens = await refreshMobileSession(body.refreshToken);
  if (!tokens) return Response.json({ apiVersion: "1", error: { code: "invalid_refresh", message: "Sessionen har gått ut eller återkallats." } }, { status: 401 });
  return mobileResponse(tokens);
}
