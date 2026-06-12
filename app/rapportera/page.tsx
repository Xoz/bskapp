import { getAllSettings } from "@/lib/db";
import PitchLines from "@/components/PitchLines";
import ReportCodeForm from "./ReportCodeForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ReportPage() {
  const settings = getAllSettings();

  return (
    <main
      className="flex-1 flex items-center justify-center p-6 relative overflow-hidden"
      style={{
        background:
          "radial-gradient(1000px 500px at 80% -10%, color-mix(in srgb, var(--accent), transparent 88%), transparent 60%), linear-gradient(160deg, var(--primary-dark), var(--primary-deep) 75%)",
      }}
    >
      <PitchLines className="pointer-events-none absolute -left-28 top-1/2 -translate-y-1/2 h-[130%] text-white/[0.04]" />

      <div className="w-full max-w-sm relative rise">
        <div className="text-center mb-8">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-black rotate-[-4deg]"
            style={{
              background: "linear-gradient(150deg, color-mix(in srgb, var(--accent), #fff 25%), var(--accent))",
              color: "var(--primary-deep)",
              fontFamily: "var(--font-display)",
              boxShadow: "inset 0 2px 0 rgba(255,255,255,0.5), 0 12px 24px -10px rgba(0,0,0,0.5)",
            }}
          >
            {settings.club_name?.slice(0, 1) || "B"}
          </div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
            Rapportera match
          </h1>
          <p className="mt-2 text-sm text-white/55">
            {settings.team_name} · Ange matchkoden du fått av tränaren
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
          <ReportCodeForm />
        </div>

        <p className="mt-6 text-center text-xs text-white/40">
          Tränare?{" "}
          <Link href="/login" className="underline hover:text-white/70">
            Logga in här
          </Link>
        </p>
      </div>
    </main>
  );
}
