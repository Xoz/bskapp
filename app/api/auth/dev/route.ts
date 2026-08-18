import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { userSessionToken, coachEmailToken } from "@/lib/auth";

export const runtime = "nodejs";

// DEV-ONLY genväg för inloggning utan Google. Hela routen är död i produktion
// (returnerar 404) så den aldrig kan bli en auth-bypass i en skarp miljö.
// Öppna /api/auth/dev i webbläsaren → loggas in som admin (ADMIN_EMAIL) och
// landar på /idag. Använd ?role=coach|leader|parent|player för annan roll.
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = new URL(req.url);
  const origin = url.origin;
  const role = (url.searchParams.get("role") ?? "admin").trim();
  const allowedRoles = ["admin", "head_coach", "coach", "leader", "parent", "player"];
  const finalRole = allowedRoles.includes(role) ? role : "admin";

  const email = (process.env.ADMIN_EMAIL ?? "dev@local.test").trim().toLowerCase();
  const name = "Dev " + finalRole;

  // Hitta-eller-skapa användaren och säkerställ rollen.
  const created = await run(
    "INSERT INTO users (email, name) VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET name = excluded.name RETURNING id",
    [email, name]
  );
  const user = (created[0] as { id: number } | undefined) ??
    (await get<{ id: number }>("SELECT id FROM users WHERE lower(email) = ?", [email]));
  if (!user) {
    return new NextResponse("Kunde inte skapa dev-användare", { status: 500 });
  }

  await run("UPDATE users SET active = 1 WHERE id = ?", [user.id]);
  await run(
    "INSERT INTO user_roles (user_id, role) VALUES (?, ?) ON CONFLICT DO NOTHING",
    [user.id, finalRole]
  );

  const destination = finalRole === "parent" || finalRole === "player" ? "/mina-spelare" : "/idag";
  const maxAge = 60 * 60 * 24 * 90;
  const res = NextResponse.redirect(`${origin}${destination}`);

  res.cookies.set("bsk_session", userSessionToken(user.id), {
    httpOnly: true,
    secure: false,
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
  res.cookies.set("bsk_coach_name", name, {
    httpOnly: true,
    sameSite: "lax",
    maxAge,
    path: "/",
  });

  return res;
}
