import { NextRequest, NextResponse } from "next/server";
import { get, getSetting, run } from "@/lib/db";
import { userSessionToken, coachEmailToken, requestOrigin } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");
  const origin = requestOrigin(req);

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

  // Nya konton administreras i users/user_roles. Den gamla vitlistan accepteras
  // under migreringen och skapar då ett riktigt konto vid första inloggningen.
  const allowed = await getSetting("allowed_coach_emails");
  const list = allowed
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const inviteToken = req.cookies.get("bsk_invite_token")?.value ?? "";
  const storedInvite = (await getSetting("coach_invite_token")).trim();
  const inviteExpires = (await getSetting("coach_invite_expires")).trim();
  const validInvite = !!inviteToken && inviteToken === storedInvite && !!inviteExpires && new Date(inviteExpires) > new Date();

  const normalizedEmail = String(email).trim().toLowerCase();
  let appUser = await get<{ id: number; active: number }>(
    "SELECT id, active FROM users WHERE lower(email) = ?",
    [normalizedEmail]
  );
  if (!appUser && (list.includes(normalizedEmail) || validInvite)) {
    const adminEmail = (process.env.ADMIN_EMAIL ?? list[0] ?? normalizedEmail).trim().toLowerCase();
    const created = await run(
      "INSERT INTO users (email, name) VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET name = excluded.name RETURNING id, active",
      [normalizedEmail, typeof name === "string" ? name.slice(0, 60) : ""]
    );
    appUser = created[0] as { id: number; active: number } | undefined;
    if (appUser) {
      await run(
        "INSERT INTO user_roles (user_id, role) VALUES (?, ?) ON CONFLICT DO NOTHING",
        [appUser.id, normalizedEmail === adminEmail ? "admin" : "coach"]
      );
      if (validInvite) {
        await run("UPDATE settings SET value = '' WHERE key IN ('coach_invite_token', 'coach_invite_expires')");
      }
    }
  }
  if (!appUser || !appUser.active) {
    return NextResponse.redirect(`${origin}/login?google_error=not_allowed`);
  }
  if (process.env.ADMIN_EMAIL?.trim().toLowerCase() === normalizedEmail) {
    await run("INSERT INTO user_roles (user_id, role) VALUES (?, 'admin') ON CONFLICT DO NOTHING", [appUser.id]);
  }

  const primaryRole = await get<{ role: string }>(
    `SELECT role FROM user_roles WHERE user_id = ?
     ORDER BY CASE role WHEN 'admin' THEN 0 WHEN 'head_coach' THEN 1 WHEN 'coach' THEN 2 WHEN 'leader' THEN 3 WHEN 'parent' THEN 4 ELSE 5 END
     LIMIT 1`,
    [appUser.id]
  );
  const destination = primaryRole?.role === "parent" || primaryRole?.role === "player" ? "/mina-spelare" : "/oversikt";
  const maxAge = 60 * 60 * 24 * 90;
  const res = NextResponse.redirect(`${origin}${destination}`);

  res.cookies.set("bsk_session", userSessionToken(appUser.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
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
  res.cookies.delete("bsk_invite_token");

  return res;
}
