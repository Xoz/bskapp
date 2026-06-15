import Link from "next/link";
import { redirect } from "next/navigation";
import { getMatchesByDate } from "@/lib/queries";
import { getAllSettings } from "@/lib/db";
import { swedishToday } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "Livescore" };

export default async function LiveLandingPage() {
  const today = swedishToday();
  const [matches, settings] = await Promise.all([getMatchesByDate(today), getAllSettings()]);

  // Exakt en match idag → gå direkt dit
  if (matches.length === 1) redirect(`/live/${matches[0].id}`);

  return (
    <main className="flex-1 p-6 max-w-md w-full mx-auto" style={{ paddingTop: "max(2rem, env(safe-area-inset-top))" }}>
      <div className="text-center mb-8">
        <p className="eyebrow">{settings.team_name}</p>
        <h1 className="text-[1.7rem] font-bold mt-0.5">Livescore</h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
          Följ lagets matcher live – ställning och händelser i realtid.
        </p>
      </div>

      {matches.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-3xl mb-3">⚽</p>
          <p className="font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>
            Ingen match idag
          </p>
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            Livescore visas här när det är matchdag.
          </p>
          <Link href="/" className="btn-secondary mt-5 inline-flex">Till startsidan</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => {
            const hasResult = m.our_score != null && m.opponent_score != null;
            return (
              <Link
                key={m.id}
                href={`/live/${m.id}`}
                className="card card-hover p-5 flex items-center gap-4"
              >
                <span className="text-2xl">📡</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate" style={{ fontFamily: "var(--font-display)" }}>
                    {m.home_away === "home" ? "Hemma mot" : "Borta mot"} {m.opponent}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
                    {m.start_time ? `Avspark ${m.start_time}` : "Idag"}
                    {m.report_open ? " · rapportering öppen" : ""}
                  </p>
                </div>
                <span
                  className="stat-number text-lg"
                  style={{ color: hasResult ? "var(--ink)" : "var(--ink-faint)" }}
                >
                  {hasResult ? `${m.our_score}–${m.opponent_score}` : "–"}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
