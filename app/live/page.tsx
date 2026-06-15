import Link from "next/link";
import { redirect } from "next/navigation";
import { getMatches, mootMatchIds, cupRoundLabel, type Match } from "@/lib/queries";
import { getAllSettings } from "@/lib/db";
import { swedishToday } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "Livescore" };

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("sv-SE", { weekday: "short", month: "short", day: "numeric" });
}

function matchLabel(m: Match): string {
  const round = cupRoundLabel(m);
  if (round && (!m.opponent || m.opponent === "TBD")) return round;
  const prefix = m.home_away === "home" ? "Hemma mot" : "Borta mot";
  return `${prefix} ${m.opponent}`;
}

export default async function LiveLandingPage() {
  const today = swedishToday();
  const [allMatches, settings] = await Promise.all([getMatches(), getAllSettings()]);

  const moot = mootMatchIds(allMatches);

  const todayMatches = allMatches
    .filter((m) => m.date === today)
    .sort((a, b) =>
      (a.start_time ?? "").localeCompare(b.start_time ?? "") || a.id - b.id
    );

  const upcomingMatches = allMatches
    .filter((m) => m.date > today && !moot.has(m.id))
    .sort((a, b) =>
      a.date.localeCompare(b.date) ||
      (a.start_time ?? "").localeCompare(b.start_time ?? "") ||
      a.id - b.id
    )
    .slice(0, 5);

  // Exakt en match idag → gå direkt dit
  if (todayMatches.length === 1) redirect(`/live/${todayMatches[0].id}`);

  return (
    <main className="flex-1 p-6 max-w-md w-full mx-auto" style={{ paddingTop: "max(2rem, env(safe-area-inset-top))" }}>
      <div className="text-center mb-8">
        <p className="eyebrow">{settings.team_name}</p>
        <h1 className="text-[1.7rem] font-bold mt-0.5">Livescore</h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
          Följ lagets matcher live – ställning och händelser i realtid.
        </p>
      </div>

      {todayMatches.length > 0 ? (
        <div className="space-y-3">
          {todayMatches.map((m) => {
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
                    {matchLabel(m)}
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
      ) : (
        <div className="space-y-6">
          <div className="card p-8 text-center">
            <p className="text-3xl mb-3">⚽</p>
            <p className="font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>
              Ingen match idag
            </p>
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
              Livescore visas här när det är matchdag.
            </p>
          </div>

          {upcomingMatches.length > 0 && (
            <div>
              <h2 className="font-semibold text-sm mb-3" style={{ color: "var(--ink-soft)" }}>
                Kommande matcher
              </h2>
              <div className="space-y-2">
                {upcomingMatches.map((m) => {
                  const round = cupRoundLabel(m);
                  const sub = [
                    formatDate(m.date),
                    m.start_time ? `kl. ${m.start_time}` : null,
                    m.cup_name || null,
                    round && round !== matchLabel(m) ? round : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <div key={m.id} className="card p-4 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{matchLabel(m)}</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>{sub}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <Link href="/" className="btn-secondary mt-2 inline-flex">Till startsidan</Link>
        </div>
      )}
    </main>
  );
}
