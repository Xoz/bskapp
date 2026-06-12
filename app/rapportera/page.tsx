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
      style={{ background: "var(--bg)" }}
    >
      <PitchLines className="pointer-events-none absolute -left-28 top-1/2 -translate-y-1/2 h-[130%] text-white/[0.025]" />

      <div className="w-full max-w-sm relative rise">
        <div className="text-center mb-8">
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center text-xl font-bold"
            style={{
              background: "var(--primary)",
              color: "var(--primary-deep)",
              fontFamily: "var(--font-display)",
              borderRadius: "8px",
            }}
          >
            {settings.club_name?.slice(0, 1) || "B"}
          </div>
          <h1
            className="text-2xl font-semibold"
            style={{ fontFamily: "var(--font-display)", color: "var(--ink)", letterSpacing: "-0.5px" }}
          >
            Rapportera match
          </h1>
          <p
            className="mt-2 text-[0.625rem] uppercase tracking-[0.12em]"
            style={{ color: "var(--ink-faint)" }}
          >
            {settings.team_name} · Ange matchkoden från tränaren
          </p>
        </div>

        <div className="p-8" style={{ background: "var(--bg2)", border: "1px solid var(--line)" }}>
          <ReportCodeForm />
        </div>

        <p className="mt-6 text-center text-[0.6875rem]" style={{ color: "var(--ink-faint)" }}>
          Tränare?{" "}
          <Link href="/login" className="underline hover:text-[var(--ink)]" style={{ color: "var(--ink-soft)" }}>
            Logga in här
          </Link>
        </p>
      </div>
    </main>
  );
}
