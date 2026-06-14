import { NextRequest, NextResponse } from "next/server";
import { getSetting } from "@/lib/db";
import { sessionToken, coachEmailToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");
  const origin = url.origin;

  if (errorParam) {
    return NextResponse.redirect(`${origin}/login?google_error=1`);
  }

  const storedState = req.cookies.get("bsk_oauth_state")?.value;
  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(`${origin}/login?google_error=1`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/login?google_error=1`);
  }

  const redirectUri = `${origin}/api/auth/callback/google`;

  // Byt kod mot access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${origin}/login?google_error=1`);
  }

  const { access_token } = await tokenRes.json();

  // Hämta användarinfo
  const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!userRes.ok) {
    return NextResponse.redirect(`${origin}/login?google_error=1`);
  }

  const { email, name } = await userRes.json();
  if (!email) {
    return NextResponse.redirect(`${origin}/login?google_error=1`);
  }

  // Kontrollera mot vitlistan
  const allowed = await getSetting("allowed_coach_emails");
  const list = allowed
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!list.includes(email.toLowerCase())) {
    return NextResponse.redirect(`${origin}/login?google_error=not_allowed`);
  }

  const maxAge = 60 * 60 * 24 * 90;
  const res = NextResponse.redirect(`${origin}/oversikt`);

  res.cookies.set("bsk_session", sessionToken("coach"), {
    httpOnly: true,
    sameSite: "lax",
    maxAge,
    path: "/",
  });

  res.cookies.set("bsk_coach_email", coachEmailToken(email), {
    httpOnly: true,
    sameSite: "lax",
    maxAge,
    path: "/",
  });

  if (name && typeof name === "string") {
    res.cookies.set("bsk_coach_name", name.slice(0, 60), {
      httpOnly: true,
      sameSite: "lax",
      maxAge,
      path: "/",
    });
  }

  res.cookies.delete("bsk_oauth_state");

  return res;
}
