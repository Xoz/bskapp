import { redirect } from "next/navigation";
import { getPlayerSession } from "@/lib/auth";
import { getPlayer, getEvaluations, getPlayerMatchStats } from "@/lib/queries";
import { getAllSettings } from "@/lib/db";
import { playerLogout } from "@/lib/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Min profil" };

export default async function MinProfilPage() {
  const playerId = await getPlayerSession();
  if (!playerId) redirect("/spelare/login");

  const [player, evaluations, matchStats, settings] = await Promise.all([
    getPlayer(playerId),
    getEvaluations(playerId),
    getPlayerMatchStats(playerId),
    getAllSettings(),
  ]);

  if (!player || !player.active) redirect("/spelare/login");

  const firstName = player.name.split(" ")[0];
  const latestEval = evaluations[0];
  const matchCount = matchStats.length;

  return (
    <main
      className="flex flex-col min-h-svh px-5 py-8 max-w-sm mx-auto"
      style={{ background: "var(--bg)", gap: "1.5rem" }}
    >
      {/* Header */}
      <div className="text-center pt-4">
        <p
          className="text-[0.65rem] uppercase tracking-[0.14em] mb-3"
          style={{ color: "var(--primary)", fontFamily: "var(--font-display)" }}
        >
          {settings.club_name} · {settings.team_name}
        </p>

        {/* Avatar */}
        <div
          className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full text-3xl font-bold"
          style={{
            background: "color-mix(in srgb, var(--primary) 15%, transparent)",
            border: "2px solid var(--primary)",
            color: "var(--primary)",
            fontFamily: "var(--font-display)",
          }}
        >
          {firstName[0]?.toUpperCase()}
        </div>

        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
        >
          Hej, {firstName}!
        </h1>

        {/* Badges */}
        <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
          {player.position && (
            <span
              className="text-xs px-2.5 py-1 rounded-full"
              style={{ background: "var(--bg2)", border: "1px solid var(--line)", color: "var(--ink-soft)" }}
            >
              {player.position}
            </span>
          )}
          {player.jersey_number && (
            <span
              className="text-xs px-2.5 py-1 rounded-full font-semibold"
              style={{ background: "var(--primary)", color: "var(--primary-deep)" }}
            >
              #{player.jersey_number}
            </span>
          )}
          <span
            className="text-xs px-2.5 py-1 rounded-full"
            style={{ background: "var(--bg2)", border: "1px solid var(--line)", color: "var(--ink-soft)" }}
          >
            {matchCount} {matchCount === 1 ? "match" : "matcher"}
          </span>
        </div>
      </div>

      {/* Senaste utvärdering */}
      {latestEval && (
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ background: "var(--bg2)", border: "1px solid var(--line)" }}
        >
          <p
            className="text-[0.6rem] uppercase tracking-[0.1em]"
            style={{ color: "var(--ink-faint)", fontFamily: "var(--font-display)" }}
          >
            Vad tränaren säger · {new Date(latestEval.date).toLocaleDateString("sv-SE", { month: "long", year: "numeric" })}
          </p>

          {latestEval.strengths && (
            <div>
              <p className="text-[0.7rem] font-semibold mb-1" style={{ color: "var(--primary)" }}>
                ⭐ Dina styrkor
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                {latestEval.strengths}
              </p>
            </div>
          )}

          {latestEval.development_goals && (
            <div>
              <p className="text-[0.7rem] font-semibold mb-1" style={{ color: "var(--ink-soft)" }}>
                🎯 Nästa steg
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                {latestEval.development_goals}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Intervju-knapp */}
      <div className="space-y-3">
        <a
          href="/mitt-utvecklingstrad"
          className="btn-primary w-full flex items-center justify-center gap-2"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}
        >
          🌱 Mitt utvecklingsträd
        </a>

        <a
          href="/intervju"
          className="btn-secondary w-full flex items-center justify-center gap-2"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}
        >
          💬 Starta intervju
        </a>

        {/* Logga ut */}
        <form action={playerLogout}>
          <button
            type="submit"
            className="w-full rounded-xl px-4 py-3 text-sm transition-colors"
            style={{
              background: "transparent",
              border: "1px solid var(--line)",
              color: "var(--ink-faint)",
              fontFamily: "var(--font-display)",
            }}
          >
            Logga ut
          </button>
        </form>
      </div>
    </main>
  );
}
