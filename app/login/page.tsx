import { Suspense } from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getAllSettings } from "@/lib/db";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const role = await getRole();
  if (role === "coach") redirect("/idag");
  if (role === "parent" || role === "player") redirect("/mina-spelare");
  const settings = await getAllSettings();
  return <main className="flex-1 flex items-center justify-center p-6">
    <div className="w-full max-w-sm">
      <header className="text-center mb-8">
        <Image className="mx-auto mb-5" src="/bsk-club.png" width={74} height={80} alt={settings.club_name || "Bollstanäs SK"} unoptimized />
        <h1>Välkommen till BSK</h1>
        <p className="mt-3" style={{ color: "var(--ink-secondary)" }}>{settings.team_name} · Matcher, utveckling och samtal</p>
      </header>
      <div className="bsk-login"><Suspense><LoginForm /></Suspense></div>
      <p className="mt-6 text-center text-sm" style={{ color: "var(--ink-secondary)" }}>En gemensam plats för laget.</p>
    </div>
  </main>;
}
