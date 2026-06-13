import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getMatch, getMatchPlayers, getPlayers, getMatchEvents, getMatchReporters } from "@/lib/queries";
import { deleteMatch, regenerateMatchCode, resetMatch } from "@/lib/actions";
import { STAT_FIELDS } from "@/lib/stats";
import MatchForm from "@/components/MatchForm";
import LiveFeed from "@/components/LiveFeed";
import Avatar from "@/components/Avatar";
import ConfirmForm from "@/components/ConfirmForm";
import CopyLinkButton from "@/components/CopyLinkButton";
import ManualEventForm from "@/components/ManualEventForm";
import EventEditor from "@/components/EventEditor";
import { IconArrowLeft } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const role = await getRole();
  if (!role) redirect("/login");

  const { id } = await params;
  const match = await getMatch(Number(id));
  if (!match) notFound();

  const [players, matchPlayers, events, reporters] = await Promise.all([
    getPlayers(),
    getMatchPlayers(match.id),
    getMatchEvents(match.id),
    getMatchReporters(match.id),
  ]);
  const playersById = Object.fromEntries(players.map((p) => [p.id, p]));

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
          <h1 className="text-[1.7rem] font-bold mt-2">
            {match.home_away === "home" ? "Hemma mot" : "Borta mot"} {match.opponent}
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

        // Räkna händelser per reporter
        const reporterCounts: Record<string, number> = {};
        for (const ev of events) {
          const name = reporters[ev.stat_id];
          if (name) reporterCounts[name] = (reporterCounts[name] ?? 0) + 1;
        }
        const reporterRanking = Object.entries(reporterCounts).sort((a, b) => b[1] - a[1]);

        return (
          <div className="card p-5 md:p-6">
            <h2 className="font-semibold mb-4">Matchsammanställning</h2>
            <div className="grid grid-cols-3 sm:grid-cols-7 gap-3">
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
        );
      })()}

      {role === "coach" ? (
        <>
          {/* Matchkod – delas med den som rapporterar statistik */}
          <div className="panel-dark p-6 md:p-7 flex items-center gap-6 flex-wrap">
            <div className="flex-1 min-w-52 relative">
              <p className="eyebrow text-white/45">Matchkod</p>
              <p className="text-sm text-white/65 mt-1.5 max-w-xs">
                Dela koden med den förälder som rapporterar statistik – den anges på{" "}
                <span className="font-semibold text-white">/rapportera</span> och kräver ingen
                inloggning.
              </p>
              <div className="flex items-center gap-4 mt-3">
                <CopyLinkButton code={match.code} />
                <form action={regenerateMatchCode}>
                  <input type="hidden" name="id" value={match.id} />
                  <button
                    type="submit"
                    className="text-xs text-white/45 hover:text-white underline cursor-pointer"
                  >
                    Generera ny kod
                  </button>
                </form>
              </div>
            </div>
            <p
              className="stat-number relative text-[2.6rem] tracking-[0.18em] px-6 py-2.5 rounded-2xl"
              style={{
                color: "var(--accent)",
                background: "rgba(0,0,0,0.25)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              {match.code}
            </p>
          </div>

          {events.length > 0 && (
            <div className="card p-6">
              <h2 className="font-semibold">Matchflöde</h2>
              <p className="text-xs mt-1 mb-5" style={{ color: "var(--ink-faint)" }}>
                Live-rapporterade händelser – tiderna gör det lätt att hitta rätt i matchvideon.
              </p>
              <LiveFeed events={events} opponent={match.opponent} reporters={reporters} />
            </div>
          )}

          {events.length > 0 && (
            <details className="card p-6">
              <summary className="font-semibold cursor-pointer">
                Rätta statistik
                <span className="font-normal text-xs ml-2" style={{ color: "var(--ink-faint)" }}>
                  ta bort felaktiga händelser
                </span>
              </summary>
              <p className="text-xs mt-1 mb-4" style={{ color: "var(--ink-faint)" }}>
                Tar du bort en händelse justeras både matchflödet och spelarens siffror automatiskt.
              </p>
              <EventEditor events={events} matchId={match.id} reporters={reporters} />
            </details>
          )}

          <div className="card p-6 md:p-7">
            <h2 className="font-semibold mb-1">Lägg till händelse</h2>
            <p className="text-xs mb-5" style={{ color: "var(--ink-faint)" }}>
              Komplettera statistik vid videogenomgång – händelsen sparas i matchflödet.
            </p>
            <ManualEventForm matchId={match.id} players={players} periods={match.periods} />
          </div>

          <MatchForm players={players} match={match} matchPlayers={matchPlayers} />
        </>
      ) : (
        <>
          {/* Föräldravy – läsläge */}
          <div className="card overflow-hidden">
            <div className="px-6 py-5" style={{ borderBottom: "1px solid var(--line)" }}>
              <h2 className="font-semibold">Spelarstatistik</h2>
              <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
                {matchPlayers.length === 0
                  ? "Ingen statistik rapporterad ännu."
                  : STAT_FIELDS.map((f) => `${f.short} = ${f.label}`).join(" · ")}
              </p>
            </div>
            {matchPlayers.length > 0 && (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Spelare</th>
                      {STAT_FIELDS.map((f) => (
                        <th key={f.id} title={f.label}>{f.short}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matchPlayers.map((mp) => {
                      const p = playersById[mp.player_id];
                      if (!p) return null;
                      const row = mp as unknown as Record<string, number>;
                      return (
                        <tr key={mp.player_id}>
                          <td>
                            <span className="flex items-center gap-2.5 font-medium whitespace-nowrap">
                              <Avatar name={p.name} jersey={p.jersey_number} size={30} />
                              {p.name}
                            </span>
                          </td>
                          {STAT_FIELDS.map((f) => (
                            <td key={f.id}>{row[f.id] || 0}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {events.length > 0 && (
            <div className="card p-6">
              <h2 className="font-semibold">Matchflöde</h2>
              <p className="text-xs mt-1 mb-5" style={{ color: "var(--ink-faint)" }}>
                Live-rapporterade händelser med matchtid.
              </p>
              <LiveFeed events={events} opponent={match.opponent} reporters={reporters} />
            </div>
          )}

          <div className="card p-5 text-sm" style={{ color: "var(--ink-soft)" }}>
            Ska du rapportera den här matchen? Be tränaren om matchkoden och ange den på{" "}
            <Link href="/rapportera" className="font-semibold underline" style={{ color: "var(--primary)" }}>
              rapporteringssidan
            </Link>
            .
          </div>
        </>
      )}
    </div>
  );
}
