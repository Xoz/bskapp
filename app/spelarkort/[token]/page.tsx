import { notFound } from "next/navigation";
import { getPlayerByShareToken, shareLinkActive, getEvaluations, getScores, getPlayerDevelopment, getPlayerMatchStats } from "@/lib/queries";
import { getAllSettings } from "@/lib/db";
import { CATEGORIES } from "@/lib/svff";
import { STAT_FIELDS } from "@/lib/stats";
import { positionLabel } from "@/lib/positions";
import SkillRadar from "@/components/SkillRadar";
import DevelopmentChart from "@/components/DevelopmentChart";
import Avatar from "@/components/Avatar";

export const dynamic = "force-dynamic";

function categoryAverages(scores: Record<string, number>) {
  return CATEGORIES.map((cat) => {
    const levels = cat.skills.map((s) => scores[s.id]).filter((v): v is number => v != null);
    return {
      category: cat.short,
      value: levels.length > 0 ? Math.round((levels.reduce((a, b) => a + b, 0) / levels.length) * 100) / 100 : 0,
    };
  });
}

export default async function PlayerCardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const player = await getPlayerByShareToken(token);
  if (!player) notFound();

  // Länken gäller bara i 48 timmar – visa en vänlig sida om den gått ut
  if (!shareLinkActive(player)) {
    const settings = await getAllSettings();
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "var(--bg)" }}>
        <div className="card p-8 max-w-sm w-full text-center">
          <p className="text-4xl mb-4">⏳</p>
          <h1 className="font-semibold text-xl mb-2" style={{ fontFamily: "var(--font-display)" }}>
            Länken har gått ut
          </h1>
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            Den här spelarlänken gäller i 48 timmar och har slutat fungera. Be tränaren skapa en ny länk inför nästa spelarsamtal.
          </p>
          <p className="eyebrow mt-6" style={{ color: "var(--ink-faint)" }}>
            {settings.team_name} · {settings.club_name}
          </p>
        </div>
      </div>
    );
  }

  const [settings, evaluations, development, matchStats] = await Promise.all([
    getAllSettings(),
    getEvaluations(player.id),
    getPlayerDevelopment(player.id),
    getPlayerMatchStats(player.id),
  ]);
  const latest = evaluations[0];
  const previous = evaluations[1];
  const latestScores = latest ? await getScores(latest.id) : null;
  const previousScores = previous ? await getScores(previous.id) : null;
  const firstName = player.name.replace(/^Exempel:\s*/, "").split(" ")[0];
  const posLabel = positionLabel(player.position);

  // Bara matcher med faktisk aktivitet räknas
  const playedMatches = matchStats.filter((m) =>
    STAT_FIELDS.some((f) => ((m as unknown as Record<string, number>)[f.id] ?? 0) > 0)
  );
  const totals = STAT_FIELDS.reduce((acc, f) => {
    acc[f.id] = playedMatches.reduce((s, m) => s + ((m as unknown as Record<string, number>)[f.id] ?? 0), 0);
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Klubbrad */}
        <p className="eyebrow text-center" style={{ color: "var(--ink-faint)" }}>
          {settings.team_name} · {settings.club_name}
        </p>

        {/* Spelarhuvud */}
        <div className="card p-6 flex items-center gap-5 flex-wrap">
          <Avatar name={player.name} jersey={player.jersey_number} size={64} />
          <div className="flex-1 min-w-40">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-[1.6rem] font-bold leading-tight">{player.name}</h1>
              {player.jersey_number != null && (
                <span className="badge" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
                  #{player.jersey_number}
                </span>
              )}
            </div>
            <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
              {posLabel ?? "Spelarkort"}
              {playedMatches.length > 0 && ` · ${playedMatches.length} ${playedMatches.length === 1 ? "match" : "matcher"}`}
            </p>
          </div>
        </div>

        {/* AI-hälsning riktad till spelaren */}
        {player.share_summary && (
          <div className="card p-6" style={{ background: "var(--primary-ghost)", border: "1px solid var(--primary-soft)" }}>
            <p className="eyebrow mb-2" style={{ color: "var(--primary)" }}>Hej {firstName}! 👋</p>
            <p className="text-[0.95rem] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--ink)" }}>
              {player.share_summary}
            </p>
          </div>
        )}

        {/* Säsongssiffror */}
        {playedMatches.length > 0 && (
          <div className="card p-6">
            <p className="eyebrow mb-3">Säsongen i siffror</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {STAT_FIELDS.filter((f) => totals[f.id] > 0).map((f) => (
                <div key={f.id} className="text-center rounded-xl py-3" style={{ background: "var(--surface-2, var(--primary-ghost))" }}>
                  <p className="stat-number text-2xl font-bold" style={{ color: "var(--primary)" }}>{totals[f.id]}</p>
                  <p className="text-[0.7rem] mt-0.5" style={{ color: "var(--ink-faint)" }}>{f.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Färdighetsprofil */}
        {latest && latestScores && (
          <div className="card p-6">
            <p className="eyebrow mb-0.5">Min profil</p>
            <h2 className="font-semibold mb-1">Vad jag är bra på just nu</h2>
            <p className="text-xs mb-2" style={{ color: "var(--ink-faint)" }}>
              {latest.date}
              {previous ? ` jämfört med ${previous.date} (streckad)` : ""}
            </p>
            <SkillRadar
              data={categoryAverages(latestScores)}
              compare={previousScores ? categoryAverages(previousScores) : undefined}
            />
          </div>
        )}

        {/* Utveckling över tid */}
        {development.length > 1 && (
          <div className="card p-6">
            <p className="eyebrow mb-0.5">Min resa</p>
            <h2 className="font-semibold mb-2">Hur jag utvecklats</h2>
            <DevelopmentChart data={development} />
          </div>
        )}

        {/* Styrkor & mål */}
        {latest && (latest.strengths || latest.development_goals) && (
          <div className="grid sm:grid-cols-2 gap-4">
            {latest.strengths && (
              <div className="card p-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">⭐</span>
                  <h2 className="font-semibold">Mina styrkor</h2>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--ink-soft)" }}>
                  {latest.strengths}
                </p>
              </div>
            )}
            {latest.development_goals && (
              <div className="card p-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🎯</span>
                  <h2 className="font-semibold">Vad jag tränar på</h2>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--ink-soft)" }}>
                  {latest.development_goals}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Match för match */}
        {playedMatches.length > 0 && (
          <div className="card p-6">
            <p className="eyebrow mb-3">Match för match</p>
            <div className="overflow-x-auto -mx-2">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Match</th>
                    {STAT_FIELDS.map((f) => (
                      <th key={f.id} title={f.label}>{f.short}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {playedMatches.map((m) => {
                    const row = m as unknown as Record<string, number>;
                    const hasResult = m.our_score != null && m.opponent_score != null;
                    return (
                      <tr key={m.match_id}>
                        <td>
                          <span className="font-medium whitespace-nowrap">{m.opponent}</span>
                          <span className="block text-[0.7rem]" style={{ color: "var(--ink-faint)" }}>
                            {m.date}{hasResult ? ` · ${m.our_score}–${m.opponent_score}` : ""}
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
          </div>
        )}

        {!latest && playedMatches.length === 0 && (
          <div className="card p-10 text-center">
            <p className="text-4xl mb-3">⚽</p>
            <p className="font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>
              Snart fylls kortet på
            </p>
            <p className="text-sm max-w-sm mx-auto" style={{ color: "var(--ink-soft)" }}>
              Här kommer {firstName} kunna se sin statistik och utveckling när matcher rapporterats och utvärderingar gjorts.
            </p>
          </div>
        )}

        <p className="text-center text-[0.7rem] pt-2" style={{ color: "var(--ink-faint)" }}>
          Den här sidan är personlig för {firstName}. Dela inte länken vidare.
        </p>
      </div>
    </div>
  );
}
