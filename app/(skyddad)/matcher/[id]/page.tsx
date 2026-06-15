import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getMatch, getMatchPlayers, getPlayers, getMatchEvents, getMatchReporters, getMatchSquad } from "@/lib/queries";
import { deleteMatch, resetMatch } from "@/lib/actions";
import { STAT_FIELDS } from "@/lib/stats";
import { level as levelInfo } from "@/lib/levels";
import MatchForm from "@/components/MatchForm";
import LiveFeed from "@/components/LiveFeed";
import Avatar from "@/components/Avatar";
import ConfirmForm from "@/components/ConfirmForm";
import ManualEventForm from "@/components/ManualEventForm";
import EventEditor from "@/components/EventEditor";
import { IconArrowLeft, IconArrowRight } from "@/components/Icons";
import { swedishToday } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const role = await getRole();
  if (!role) redirect("/login");

  const { id } = await params;
  const match = await getMatch(Number(id));
  if (!match) notFound();

  const [players, matchPlayers, events, reporters, squadIds] = await Promise.all([
    getPlayers(),
    getMatchPlayers(match.id),
    getMatchEvents(match.id),
    getMatchReporters(match.id),
    getMatchSquad(match.id),
  ]);
  const playersById = Object.fromEntries(players.map((p) => [p.id, p]));
  const mLevel = levelInfo(match.level);
  const today = swedishToday();
  const isUpcoming = match.date >= today;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/matcher"
            className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-[var(--primary)]"
            style={{ color: "var(--ink-soft)", fontFamily: "var(--font-display)" }}
          >
            <IconArrowLeft width={15} height={15} /> Matcher
          </Link>
          <h1 className="text-[1.7rem] font-bold mt-2 flex items-center gap-3 flex-wrap">
            {match.home_away === "home" ? "Hemma mot" : "Borta mot"} {match.opponent}
            {mLevel && (
              <span className="badge" style={{ background: "var(--bg2)", color: mLevel.color, fontSize: "0.7rem" }}>
                {mLevel.label}
              </span>
            )}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
            {match.date}{match.start_time ? ` · ${match.start_time}` : ""}
            {match.source === "calendar" && " · hämtad från kalendern"}
            {match.our_score != null && match.opponent_score != null && (
              <>
                {" · Resultat "}
                <span className="stat-number" style={{ color: "var(--ink)" }}>
                  {match.our_score}–{match.opponent_score}
                </span>
              </>
            )}
          </p>
        </div>
        {role === "coach" && (
          <div className="flex gap-3 items-center">
            <ConfirmForm
              action={resetMatch}
              message="Nollställa all statistik och klocka för den här matchen?"
            >
              <input type="hidden" name="id" value={match.id} />
              <button type="submit" className="text-sm hover:underline cursor-pointer" style={{ color: "var(--ink-faint)" }}>
                Nollställ match
              </button>
            </ConfirmForm>
            <ConfirmForm
              action={deleteMatch}
              message="Ta bort matchen permanent?"
            >
              <input type="hidden" name="id" value={match.id} />
              <button type="submit" className="text-sm hover:underline cursor-pointer" style={{ color: "var(--danger)" }}>
                Ta bort match
              </button>
            </ConfirmForm>
          </div>
        )}
      </div>

      {/* Matchsammanställning – totaler, synlig för båda roller */}
      {matchPlayers.length > 0 && (() => {
        const totals = STAT_FIELDS.map((f) => ({
          ...f,
          total: matchPlayers.reduce((sum, mp) => sum + ((mp as unknown as Record<string, number>)[f.id] ?? 0), 0),
        }));

        // Räkna händelser per reporter – skiftlägesokänsligt (slå ihop t.ex.
        // "Itzas Pappa" och "itzas pappa"), behåll först sedda stavningen
        const reporterCounts: Record<string, { name: string; count: number }> = {};
        for (const ev of events) {
          const name = reporters[ev.stat_id];
          if (!name) continue;
          const key = name.toLowerCase();
          if (!reporterCounts[key]) reporterCounts[key] = { name, count: 0 };
          reporterCounts[key].count++;
        }
        const reporterRanking = Object.values(reporterCounts)
          .map((r) => [r.name, r.count] as [string, number])
          .sort((a, b) => b[1] - a[1]);

        return (
          <details className="card overflow-hidden">
            <summary className="p-5 md:p-6 flex items-center justify-between cursor-pointer list-none select-none">
              <h2 className="font-semibold">Matchsammanställning</h2>
              <IconArrowRight width={14} height={14} className="details-chevron shrink-0" style={{ color: "var(--ink-faint)" }} />
            </summary>
            <div className="px-5 md:px-6 pb-5 md:pb-6" style={{ borderTop: "1px solid var(--line)" }}>
              <div className="grid grid-cols-3 sm:grid-cols-7 gap-3 pt-5">
                {totals.map((f) => (
                  <div key={f.id} className="text-center rounded-xl py-3 px-2" style={{ background: "var(--bg2)" }}>
                    <p className="stat-number text-2xl">{f.total}</p>
                    <p className="text-[0.7rem] mt-1" style={{ color: "var(--ink-faint)" }}>{f.short}</p>
                  </div>
                ))}
              </div>
              {reporterRanking.length > 0 && (
                <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--line)" }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: "var(--ink-soft)" }}>Bästa rapportör</p>
                  <div className="flex flex-wrap gap-2">
                    {reporterRanking.map(([name, count], i) => (
                      <span
                        key={name}
                        className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm"
                        style={{
                          background: i === 0 ? "var(--primary-soft)" : "var(--bg2)",
                          color: i === 0 ? "var(--primary)" : "var(--ink-soft)",
                          fontWeight: i === 0 ? 600 : 400,
                        }}
                      >
                        {i === 0 && <span>🏆</span>}
                        {name}
                        <span className="stat-number text-xs opacity-70">{count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>
        );
      })()}

      {role === "coach" && (
        <>
          {/* Laguttagning */}
          <Link
            href={`/matcher/${match.id}/laguttagning`}
            className="card card-hover p-5 flex items-center gap-4"
            style={isUpcoming ? { background: "var(--primary-ghost)", border: "1px solid var(--primary-soft)" } : undefined}
          >
            <span className="text-2xl">📋</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">Laguttagning</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-soft)" }}>
                {squadIds.length > 0
                  ? `${squadIds.length} spelare uttagna${mLevel ? ` · nivå ${mLevel.label}` : ""}`
                  : mLevel
                    ? `Ta ut truppen för en ${mLevel.label.toLowerCase()} match`
                    : "Sätt matchnivå och ta ut truppen"}
              </p>
            </div>
            <span className="badge" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
              {squadIds.length > 0 ? "Ändra" : "Öppna"}
            </span>
          </Link>

          {/* Liverapportering */}
          <Link
            href={`/matcher/${match.id}/live`}
            className="card card-hover p-5 flex items-center gap-4"
            style={
              match.date === today && !match.finished
                ? { background: "var(--primary-ghost)", border: "1px solid var(--primary-soft)" }
                : undefined
            }
          >
            <span className="text-2xl">⏱️</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">Liverapportering</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-soft)" }}>
                {match.finished
                  ? "Matchen är avslutad – öppna för att se eller rätta"
                  : events.length > 0
                    ? `${events.length} händelser rapporterade · fortsätt rapportera`
                    : "Starta matchklockan och rapportera mål, skott och byten live"}
              </p>
            </div>
            <span className="badge" style={{ background: "var(--accent)", color: "var(--primary-deep)" }}>
              {match.finished ? "Visa" : events.length > 0 ? "Fortsätt" : "Starta"}
            </span>
          </Link>

          {events.length > 0 && (
            <details className="card overflow-hidden">
              <summary className="p-6 flex items-center justify-between cursor-pointer list-none select-none">
                <h2 className="font-semibold">Matchflöde</h2>
                <IconArrowRight width={14} height={14} className="details-chevron shrink-0" style={{ color: "var(--ink-faint)" }} />
              </summary>
              <div className="px-6 pb-6" style={{ borderTop: "1px solid var(--line)" }}>
                <p className="text-xs mt-4 mb-5" style={{ color: "var(--ink-faint)" }}>
                  Live-rapporterade händelser – tiderna gör det lätt att hitta rätt i matchvideon.
                </p>
                <LiveFeed events={events} opponent={match.opponent} reporters={reporters} />
              </div>
            </details>
          )}

          {events.length > 0 && (
            <details className="card overflow-hidden">
              <summary className="p-6 flex items-center justify-between cursor-pointer list-none select-none">
                <div className="flex items-baseline gap-3">
                  <h2 className="font-semibold">Rätta statistik</h2>
                  <span className="text-xs" style={{ color: "var(--ink-faint)" }}>{events.length} händelser</span>
                </div>
                <IconArrowRight width={14} height={14} className="details-chevron shrink-0" style={{ color: "var(--ink-faint)" }} />
              </summary>
              <div className="px-6 pb-6" style={{ borderTop: "1px solid var(--line)" }}>
                <p className="text-xs mt-4 mb-4" style={{ color: "var(--ink-faint)" }}>
                  Ta bort felaktiga rapporteringar – matchflöde och spelarpoäng justeras automatiskt.
                </p>
                <EventEditor events={events} matchId={match.id} reporters={reporters} />
              </div>
            </details>
          )}

          <details className="card overflow-hidden">
            <summary className="p-6 md:p-7 flex items-center justify-between cursor-pointer list-none select-none">
              <h2 className="font-semibold">Lägg till händelse</h2>
              <IconArrowRight width={14} height={14} className="details-chevron shrink-0" style={{ color: "var(--ink-faint)" }} />
            </summary>
            <div className="px-6 md:px-7 pb-6 md:pb-7" style={{ borderTop: "1px solid var(--line)" }}>
              <p className="text-xs mt-4 mb-5" style={{ color: "var(--ink-faint)" }}>
                Komplettera statistik vid videogenomgång – händelsen sparas i matchflödet.
              </p>
              <ManualEventForm matchId={match.id} players={players} periods={match.periods} />
            </div>
          </details>

          <details>
            <summary className="card p-5 md:p-6 flex items-center justify-between cursor-pointer list-none select-none">
              <h2 className="font-semibold">Matchstatistik</h2>
              <IconArrowRight width={14} height={14} className="details-chevron shrink-0" style={{ color: "var(--ink-faint)" }} />
            </summary>
            <div className="space-y-4 mt-4">
              <MatchForm players={players} match={match} matchPlayers={matchPlayers} />
            </div>
          </details>
        </>
      )}
    </div>
  );
}
