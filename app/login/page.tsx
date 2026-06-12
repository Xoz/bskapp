import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getAllSettings } from "@/lib/db";
import LoginForm from "./LoginForm";
import PitchLines from "@/components/PitchLines";

export default async function LoginPage() {
  const role = await getRole();
  if (role === "coach") redirect("/");
  if (role === "parent") redirect("/matcher");

  const settings = getAllSettings();

  return (
    <main
      className="flex-1 flex items-center justify-center p-6 relative overflow-hidden"
      style={{
        background:
          "radial-gradient(1000px 500px at 80% -10%, color-mix(in srgb, var(--accent), transparent 88%), transparent 60%), radial-gradient(800px 600px at -10% 110%, color-mix(in srgb, var(--primary-light), transparent 40%), transparent 65%), linear-gradient(160deg, var(--primary-dark), var(--primary-deep) 75%)",
      }}
    >
      <PitchLines className="pointer-events-none absolute -left-28 top-1/2 -translate-y-1/2 h-[130%] text-white/[0.04]" />
      <PitchLines className="pointer-events-none absolute -right-36 -bottom-40 h-[110%] rotate-12 text-white/[0.03]" />

      <div className="w-full max-w-sm relative rise">
        <div className="text-center mb-10">
          <div
            className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[1.4rem] text-4xl font-black rotate-[-4deg]"
            style={{
              background:
                "linear-gradient(150deg, color-mix(in srgb, var(--accent), #fff 25%), var(--accent))",
              color: "var(--primary-deep)",
              fontFamily: "var(--font-display)",
              boxShadow:
                "inset 0 2px 0 rgba(255,255,255,0.5), 0 16px 32px -12px rgba(0,0,0,0.55)",
            }}
          >
            {settings.club_name?.slice(0, 1) || "B"}
          </div>
          <h1
            className="text-4xl font-bold text-white tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {settings.team_name}
          </h1>
          <p className="mt-2 text-sm text-white/55">
            {settings.club_name}{" · "}Spelarutveckling &amp; matchstatistik
          </p>
        </div>

        <div
          className="rounded-3xl p-8"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            backdropFilter: "blur(12px)",
            boxShadow: "0 24px 48px -24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)",
          }}
        >
          <LoginForm />
        </div>

        <div className="mt-8 flex items-center justify-center gap-3 text-[0.7rem] tracking-[0.14em] uppercase text-white/35" style={{ fontFamily: "var(--font-display)" }}>
          <span className="h-px w-8 bg-white/15" />
          Enligt SvFF:s riktlinjer
          <span className="h-px w-8 bg-white/15" />
        </div>
      </div>
    </main>
  );
}
