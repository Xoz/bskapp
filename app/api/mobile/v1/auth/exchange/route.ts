import { exchangeNativeAuthCode } from "@/lib/mobileAuth";
import { mobileResponse } from "@/lib/mobileApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    code?: unknown;
    codeVerifier?: unknown;
    deviceId?: unknown;
    deviceName?: unknown;
  } | null;
  if (!body || !Object.values(body).every((value) => typeof value === "string")) {
    return Response.json({ apiVersion: "1", error: { code: "invalid_exchange", message: "Ogiltigt kodutbyte." } }, { status: 400 });
  }
  const result = await exchangeNativeAuthCode(body as { code: string; codeVerifier: string; deviceId: string; deviceName: string });
  if (!result) return Response.json({ apiVersion: "1", error: { code: "invalid_exchange", message: "Koden är ogiltig eller har gått ut." } }, { status: 401 });
  return mobileResponse(result);
}
