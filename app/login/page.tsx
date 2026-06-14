import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getAllSettings } from "@/lib/db";
import LoginForm from "./LoginForm";
import PitchLines from "@/components/PitchLines";

export default async function LoginPage() {
  const role = await getRole();
  if (role === "coach") redirect("/oversikt");

  const settings = await getAllSettings();

  return (
    <main
      className="flex-1 flex items-center justify-center p-6 relative overflow-hidden"
      style={{ background: "var(--bg)" }}
    >
      <PitchLines className="pointer-events-none absolute -left-28 top-1/2 -translate-y-1/2 h-[130%] text-white/[0.025]" />
      <PitchLines className="pointer-events-none absolute -right-36 -bottom-40 h-[110%] rotate-12 text-white/[0.02]" />

      <div className="w-full max-w-sm relative rise">
        <div className="text-center mb-10">
          <div
            className="mx-auto mb-5 flex h-16 w-16 items-center justify-center text-3xl font-bold"
            style={{
              background: "var(--primary)",
              color: "var(--primary-deep)",
              fontFamily: "var(--font-display)",
              borderRadius: "10px",
            }}
          >
            {settings.club_name?.slice(0, 1) || "B"}
          </div>
          <h1
            className="text-3xl font-semibold"
            style={{ fontFamily: "var(--font-display)", color: "var(--ink)", letterSpacing: "-0.5px" }}
          >
            {settings.team_name}
          </h1>
          <p
            className="mt-2 text-[0.625rem] uppercase tracking-[0.12em]"
            style={{ color: "var(--ink-faint)" }}
          >
            {settings.club_name} · Spelarutveckling &amp; matchstatistik
          </p>
        </div>

        <div
          className="p-8"
          style={{ background: "var(--bg2)", border: "1px solid var(--line)" }}
        >
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>

        <div
          className="mt-8 flex items-center justify-center gap-3 text-[0.5625rem] tracking-[0.14em] uppercase"
          style={{ color: "var(--ink-faint)" }}
        >
          <span className="h-px w-8" style={{ background: "var(--line)" }} />
          Enligt SvFF:s riktlinjer
          <span className="h-px w-8" style={{ background: "var(--line)" }} />
        </div>
      </div>
    </main>
  );
}
