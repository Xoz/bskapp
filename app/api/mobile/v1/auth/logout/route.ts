import { bearerTokenFromRequest, revokeMobileAccessToken } from "@/lib/mobileAuth";
import { mobileResponse } from "@/lib/mobileApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const accessToken = bearerTokenFromRequest(request);
  if (!accessToken || !(await revokeMobileAccessToken(accessToken))) {
    return Response.json({ apiVersion: "1", error: { code: "unauthorized", message: "Sessionen finns inte." } }, { status: 401 });
  }
  return mobileResponse({ revoked: true });
}
