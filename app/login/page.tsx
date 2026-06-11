import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getAllSettings } from "@/lib/db";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const role = await getRole();
  if (role === "coach") redirect("/");
  if (role === "parent") redirect("/matcher");

  const settings = getAllSettings();

  return (
    <main className="flex-1 flex items-center justify-center p-6" style={{ background: "var(--primary)" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-black"
            style={{ background: "var(--accent)", color: "var(--primary)" }}
          >
            {settings.club_name?.slice(0, 1) || "B"}
          </div>
          <h1 className="text-2xl font-bold text-white">{settings.team_name}</h1>
          <p className="mt-1 text-sm text-white/60">
            {settings.club_name} · Spelarutveckling och matchstatistik
          </p>
        </div>

        <div className="card p-8">
          <h2 className="text-lg font-semibold mb-1">Logga in</h2>
          <p className="text-sm mb-6" style={{ color: "var(--ink-soft)" }}>
            Ange lagets kod. Tränare och föräldrar har olika koder.
          </p>
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-white/50">
          Byggd enligt SvFF:s riktlinjer för barn- och ungdomsfotboll
        </p>
      </div>
    </main>
  );
}
