import Link from "next/link";
import { redirect } from "next/navigation";
import { getRole, getPlayerSession } from "@/lib/auth";
import { getAllSettings } from "@/lib/db";
import PitchLines from "@/components/PitchLines";
import { IconWhistle, IconBall, IconPlayers, IconArrowRight } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const [role, playerId] = await Promise.all([getRole(), getPlayerSession()]);
  if (role === "coach") redirect("/oversikt");
  if (role === "parent") redirect("/matcher");
  if (playerId) redirect("/min-profil");

  const settings = await getAllSettings();

  return (
    <main
      className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{
        background: "var(--bg)",
        minHeight: "100svh",
        paddingTop: "max(1.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
      }}
    >
      <PitchLines className="pointer-events-none absolute -left-32 top-1/2 -translate-y-1/2 h-[140%] text-white/[0.025]" />
      <PitchLines className="pointer-events-none absolute -right-40 -bottom-36 h-[110%] rotate-12 text-white/[0.018]" />

      <div className="w-full max-w-xs relative rise space-y-8">
        {/* Logotyp + lagnamn */}
        <div className="text-center">
          <div
            className="mx-auto mb-5 flex h-24 w-24 items-center justify-center"
            style={{ borderRadius: "22px", background: "#0a0b0d", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <span
              className="text-4xl font-bold"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "-1.5px" }}
            >
              <span style={{ color: "var(--primary)" }}>+</span>
              <span style={{ color: "#fff" }}>90</span>
            </span>
          </div>
          <h1
            className="text-3xl font-semibold tracking-tight"
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

        {/* Rollkort */}
        <div className="space-y-3">
          {/* Tränare */}
          <Link
            href="/login"
            className="group flex items-center gap-4 rounded-2xl px-5 py-4 transition-opacity hover:opacity-85"
            style={{ background: "var(--bg2)", border: "1px solid var(--line)" }}
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
            >
              <IconWhistle width={20} height={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm" style={{ color: "var(--ink)" }}>Tränare</p>
              <p className="text-[0.7rem] mt-0.5" style={{ color: "var(--ink-faint)" }}>
                Trupp, utvärderingar och statistik
              </p>
            </div>
            <IconArrowRight
              width={14}
              height={14}
              className="shrink-0 transition-transform group-hover:translate-x-0.5"
              style={{ color: "var(--ink-faint)" }}
            />
          </Link>

          {/* Förälder / Rapportör */}
          <Link
            href="/rapportera"
            className="group flex items-center gap-4 rounded-2xl px-5 py-4 transition-opacity hover:opacity-85"
            style={{ background: "var(--bg2)", border: "1px solid var(--line)" }}
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
            >
              <IconBall width={20} height={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm" style={{ color: "var(--ink)" }}>Förälder &amp; Rapportör</p>
              <p className="text-[0.7rem] mt-0.5" style={{ color: "var(--ink-faint)" }}>
                Registrera händelser live under match
              </p>
            </div>
            <IconArrowRight
              width={14}
              height={14}
              className="shrink-0 transition-transform group-hover:translate-x-0.5"
              style={{ color: "var(--ink-faint)" }}
            />
          </Link>

          {/* Spelare */}
          <Link
            href="/spelare/login"
            className="group flex items-center gap-4 rounded-2xl px-5 py-4 transition-opacity hover:opacity-85"
            style={{ background: "var(--bg2)", border: "1px solid var(--line)" }}
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
            >
              <IconPlayers width={20} height={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm" style={{ color: "var(--ink)" }}>Spelare</p>
              <p className="text-[0.7rem] mt-0.5" style={{ color: "var(--ink-faint)" }}>
                Berätta om din säsong för tränaren
              </p>
            </div>
            <IconArrowRight
              width={14}
              height={14}
              className="shrink-0 transition-transform group-hover:translate-x-0.5"
              style={{ color: "var(--ink-faint)" }}
            />
          </Link>
        </div>

        <p
          className="text-center text-[0.55rem] uppercase tracking-[0.14em]"
          style={{ color: "var(--ink-faint)" }}
        >
          Enligt SvFF:s riktlinjer för barnfotboll
        </p>
      </div>
    </main>
  );
}
