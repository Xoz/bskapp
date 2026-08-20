import { requestOrigin } from "@/lib/auth";
import { createNativeOAuthState, validPkceChallenge } from "@/lib/mobileAuth";
import { mobileResponse } from "@/lib/mobileApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return Response.json({ apiVersion: "1", error: { code: "not_configured", message: "Google-inloggning är inte konfigurerad." } }, { status: 503 });
  const body = await request.json().catch(() => null) as { codeChallenge?: unknown } | null;
  if (!validPkceChallenge(body?.codeChallenge)) {
    return Response.json({ apiVersion: "1", error: { code: "invalid_pkce", message: "En giltig S256 PKCE challenge krävs." } }, { status: 400 });
  }
  const state = await createNativeOAuthState(body.codeChallenge);
  const callback = `${requestOrigin(new (await import("next/server")).NextRequest(request))}/api/auth/callback/google`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callback,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return mobileResponse({ authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
}
