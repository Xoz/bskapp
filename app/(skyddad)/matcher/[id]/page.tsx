import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getMatch, getMatchPlayers, getPlayers, getMatchEvents } from "@/lib/queries";
import { deleteMatch, regenerateMatchCode } from "@/lib/actions";
import { STAT_FIELDS } from "@/lib/stats";
import MatchForm from "@/components/MatchForm";
import LiveFeed from "@/components/LiveFeed";
import Avatar from "@/components/Avatar";
import { IconArrowLeft } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const role = await getRole();
  if (!role) redirect("/login");

  const { id } = await params;
  const match = await getMatch(Number(id));
  if (!match) notFound();

  const players = await getPlayers();
  const matchPlayers = await getMatchPlayers(match.id);
  const events = await getMatchEvents(match.id);
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
            {match.date}
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
          <form action={deleteMatch}>
            <input type="hidden" name="id" value={match.id} />
            <button
              type="submit"
              className="text-sm hover:underline cursor-pointer"
              style={{ color: "var(--danger)" }}
            >
              Ta bort match
            </button>
          </form>
        )}
      </div>

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
              <form action={regenerateMatchCode} className="mt-3">
                <input type="hidden" name="id" value={match.id} />
                <button
                  type="submit"
                  className="text-xs text-white/45 hover:text-white underline cursor-pointer"
                >
                  Generera ny kod
                </button>
              </form>
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
              <LiveFeed events={events} opponent={match.opponent} />
            </div>
          )}

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
                              <Avatar name={p.name} size={30} />
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
              <LiveFeed events={events} opponent={match.opponent} />
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
