import Link from "next/link";
import { getMatches, mootMatchIds, cupRoundLabel, type Match } from "@/lib/queries";
import { IconLive } from "@/components/Icons";
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

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-semibold text-sm mb-3" style={{ color: "var(--ink-soft)" }}>
      {children}
    </h2>
  );
}

export default async function LiveLandingPage() {
  const today = swedishToday();
  const [allMatches, settings] = await Promise.all([getMatches(), getAllSettings()]);

  const moot = mootMatchIds(allMatches);

  const todayBase = allMatches
    .filter((m) => m.date === today && !moot.has(m.id))
    .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? "") || a.id - b.id);

  // Ingen poäng ännu = pågår/inte avsparkat
  const activeToday = todayBase.filter((m) => m.our_score == null || m.opponent_score == null);
  // Resultat inlagt = avslutad
  const doneToday = todayBase.filter((m) => m.our_score != null && m.opponent_score != null);

  const upcomingMatches = allMatches
    .filter((m) => m.date > today && !moot.has(m.id))
    .sort((a, b) =>
      a.date.localeCompare(b.date) ||
      (a.start_time ?? "").localeCompare(b.start_time ?? "") ||
      a.id - b.id
    )
    .slice(0, 5);

  const hasAnything = activeToday.length > 0 || doneToday.length > 0 || upcomingMatches.length > 0;

  return (
    <main className="flex-1 p-6 max-w-md w-full mx-auto" style={{ paddingTop: "max(2rem, env(safe-area-inset-top))" }}>
      <div className="text-center mb-8">
        <p className="eyebrow">{settings.team_name}</p>
        <h1 className="text-[1.7rem] font-bold mt-0.5">Livescore</h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
          Följ lagets matcher live – ställning och händelser i realtid.
        </p>
      </div>

      <div className="space-y-6">
        {!hasAnything && (
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
        )}

        {/* Pågår / inte avsparkat ännu */}
        {activeToday.length > 0 && (
          <div>
            <SectionHeading>Matcher idag</SectionHeading>
            <div className="space-y-3">
              {activeToday.map((m) => (
                <Link
                  key={m.id}
                  href={`/live/${m.id}`}
                  className="card card-hover p-5 flex items-center gap-4"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                  >
                    <IconLive width={20} height={20} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate" style={{ fontFamily: "var(--font-display)" }}>
                      {matchLabel(m)}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
                      {m.start_time ? `Avspark ${m.start_time}` : "Idag"}
                      {m.report_open ? " · rapportering öppen" : ""}
                    </p>
                  </div>
                  <span className="stat-number text-lg" style={{ color: "var(--ink-faint)" }}>–</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Avslutade matcher idag */}
        {doneToday.length > 0 && (
          <div>
            <SectionHeading>Redan spelade idag</SectionHeading>
            <div className="space-y-3">
              {doneToday.map((m) => {
                const won = m.our_score! > m.opponent_score!;
                const lost = m.our_score! < m.opponent_score!;
                const resultColor = won ? "var(--ok)" : lost ? "var(--danger)" : "var(--ink-soft)";
                return (
                  <Link
                    key={m.id}
                    href={`/live/${m.id}`}
                    className="card card-hover p-5 flex items-center gap-4"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: "var(--bg2)", color: "var(--ink-soft)" }}
                    >
                      <IconLive width={20} height={20} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate" style={{ fontFamily: "var(--font-display)" }}>
                        {matchLabel(m)}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
                        {m.start_time ? `Avspark ${m.start_time}` : "Idag"} · Avslutad
                      </p>
                    </div>
                    <span className="stat-number text-lg" style={{ color: resultColor }}>
                      {m.our_score}–{m.opponent_score}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Kommande matcher */}
        {upcomingMatches.length > 0 && (
          <div>
            <SectionHeading>Kommande matcher</SectionHeading>
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
      </div>
    </main>
  );
}
