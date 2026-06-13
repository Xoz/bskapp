import { getAllSettings } from "@/lib/db";
import { getMatchesByDate, getAllTimeReporterHighscore } from "@/lib/queries";
import PitchLines from "@/components/PitchLines";
import ReportCodeForm from "./ReportCodeForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ReportPage() {
  const today = new Date().toISOString().slice(0, 10);

  const [settings, todayMatches, highscore] = await Promise.all([
    getAllSettings(),
    getMatchesByDate(today),
    getAllTimeReporterHighscore(),
  ]);

  return (
    <main
      className="flex-1 flex items-center justify-center p-6 relative overflow-hidden"
      style={{ background: "var(--bg)" }}
    >
      <PitchLines className="pointer-events-none absolute -left-28 top-1/2 -translate-y-1/2 h-[130%] text-white/[0.025]" />

      <div className="w-full max-w-sm relative rise space-y-6">
        {/* Header */}
        <div className="text-center">
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
            {settings.team_name}
          </p>
        </div>

        {/* Dagens matcher */}
        {todayMatches.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold px-1" style={{ color: "var(--ink-soft)" }}>
              Dagens matcher
            </p>
            {todayMatches.map((match) => {
              const finished = !!match.finished;

              if (finished) {
                const hasResult = match.our_score != null && match.opponent_score != null;
                return (
                  <Link
                    key={match.id}
                    href={`/rapportera/${match.code}`}
                    className="flex items-center justify-between gap-3 rounded-2xl px-5 py-4 transition-opacity hover:opacity-80"
                    style={{ background: "var(--bg2)", border: "1px solid var(--line)" }}
                  >
                    <div>
                      <p className="font-semibold text-sm" style={{ color: "var(--ink)" }}>
                        {match.home_away === "home" ? "Hemma" : "Borta"} mot {match.opponent}
                      </p>
                      <p className="text-[0.7rem] mt-0.5" style={{ color: "var(--ink-faint)" }}>
                        {hasResult ? `Slutresultat ${match.our_score}–${match.opponent_score}` : "Avslutad"}
                      </p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: "var(--ok-bg)", color: "var(--ok)" }}>
                      Avslutad →
                    </span>
                  </Link>
                );
              }

              return (
                <Link
                  key={match.id}
                  href={`/rapportera/${match.code}`}
                  className="flex items-center justify-between gap-3 rounded-2xl px-5 py-4 transition-opacity hover:opacity-80"
                  style={{ background: "var(--primary)", color: "var(--primary-deep)" }}
                >
                  <div>
                    <p className="font-semibold text-sm">
                      {match.home_away === "home" ? "Hemma" : "Borta"} mot {match.opponent}
                    </p>
                    <p className="text-[0.7rem] opacity-70 mt-0.5">{match.start_time ?? "Öppen"}</p>
                  </div>
                  <span className="text-lg">→</span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div
            className="rounded-2xl px-5 py-4 text-center text-sm"
            style={{ background: "var(--bg2)", border: "1px solid var(--line)", color: "var(--ink-soft)" }}
          >
            Inga matcher inlagda för idag
          </div>
        )}

        {/* Kod-formulär som fallback */}
        <details className="group">
          <summary
            className="cursor-pointer text-xs text-center list-none"
            style={{ color: "var(--ink-faint)" }}
          >
            Har du en matchkod? <span className="underline">Ange den här</span>
          </summary>
          <div className="mt-3 p-6 rounded-2xl" style={{ background: "var(--bg2)", border: "1px solid var(--line)" }}>
            <ReportCodeForm />
          </div>
        </details>

        {/* Total highscore */}
        {highscore.length > 0 && (
          <div className="rounded-2xl px-5 py-4" style={{ background: "var(--bg2)", border: "1px solid var(--line)" }}>
            <p className="text-xs font-semibold mb-3" style={{ color: "var(--ink-soft)" }}>
              Säsongens bästa rapportörer
            </p>
            <ol className="space-y-2">
              {highscore.slice(0, 5).map((r, i) => (
                <li key={r.name} className="flex items-center gap-2.5">
                  <span
                    className="stat-number text-xs w-5 text-center shrink-0"
                    style={{ color: i === 0 ? "var(--primary)" : "var(--ink-faint)" }}
                  >
                    {i === 0 ? "🏆" : `${i + 1}.`}
                  </span>
                  <span className="flex-1 text-sm font-medium truncate" style={{ color: "var(--ink)" }}>
                    {r.name}
                  </span>
                  <span className="stat-number text-sm" style={{ color: "var(--ink-soft)" }}>
                    {r.events}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="flex justify-center gap-4 text-[0.6875rem]" style={{ color: "var(--ink-faint)" }}>
          <span>
            Tränare?{" "}
            <Link href="/login" className="underline hover:text-[var(--ink)]" style={{ color: "var(--ink-soft)" }}>
              Logga in
            </Link>
          </span>
          <span>·</span>
          <Link href="/guide" className="underline hover:text-[var(--ink)]" style={{ color: "var(--ink-soft)" }}>
            Guide
          </Link>
        </div>
      </div>
    </main>
  );
}
