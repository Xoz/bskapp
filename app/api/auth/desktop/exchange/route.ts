import { NextResponse } from "next/server";
import { coachEmailToken, userSessionToken } from "../../../../../lib/auth";
import { exchangeDesktopAuthCode } from "../../../../../lib/mobileAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  // Kodutbytet är endast JSON. Vanliga cross-site-formulär avvisas.
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return NextResponse.json({ error: "invalid_request" }, { status: 415, headers });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body.code !== "string" || typeof body.codeVerifier !== "string") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }
  const user = await exchangeDesktopAuthCode(body.code, body.codeVerifier);
  if (!user) return NextResponse.json({ error: "invalid_exchange" }, { status: 401, headers });
  const destination = user.primaryRole === "parent" || user.primaryRole === "player" ? "/mina-spelare" : "/idag";
  const response = NextResponse.json({ destination }, { headers });
  const options = { httpOnly: true, secure: true, sameSite: "lax" as const, maxAge: 60 * 60 * 24 * 90, path: "/" };
  response.cookies.set("bsk_session", userSessionToken(user.id), options);
  response.cookies.set("bsk_coach_email", coachEmailToken(user.email), options);
  response.cookies.set("bsk_coach_name", user.name.slice(0, 60), options);
  return response;
}
