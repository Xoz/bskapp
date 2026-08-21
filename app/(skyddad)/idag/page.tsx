import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { getCoreHome } from "@/lib/developmentCore";
import { getPendingMatchEvaluations } from "@/lib/matchEvaluation";
import { listMobilePlayerMatchLoads } from "@/lib/services/development";
import CoreActivityCard from "@/components/CoreActivityCard";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.primaryRole)) redirect("/mina-spelare");
  const [{ upcoming }, pendingEvaluations, playerLoads] = await Promise.all([
    getCoreHome(),
    getPendingMatchEvaluations(),
    user.permissions.includes("view_players") ? listMobilePlayerMatchLoads(user) : Promise.resolve([]),
  ]);
  const staffing = upcoming.map((activity) => {
    const called = Number(activity.accepted_callup_count) + Number(activity.declined_callup_count) + Number(activity.pending_callup_count);
    const ready = activity.has_confirmed_squad ? Number(activity.squad_count) : Number(activity.accepted_callup_count);
    return { activity, called, ready, missing: Math.max(0, 9 - ready) };
  });
  const yellowStaffing = staffing.filter((row) => row.activity.source_team === "Gul");
  const understaffed = yellowStaffing.filter((row) => (row.activity.has_confirmed_squad || row.called > 0) && row.missing > 0);
  const unanswered = yellowStaffing.reduce((sum, row) => sum + Number(row.activity.pending_callup_count), 0);
  const highLoad = playerLoads.filter((player) => player.windowMatchCount >= 3).sort((a, b) => b.windowMatchCount - a.windowMatchCount);

  return (
    <div className="core-page">
      <header className="core-header">
        <div className="core-header-copy">
          <p className="core-kicker">Utvecklingsverktyget</p>
          <h1 className="core-title">Veckoöversikt</h1>
          <p className="core-lead">
            Matcher, bemanning, belastning och efterarbete samlat på ett ställe.
          </p>
        </div>
      </header>

      <section aria-label="Veckans läge" className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Link href="#veckans-matcher" className="core-panel p-4 md:p-5">
          <span className="caption" style={{ color: "var(--ink-muted)" }}>Matcher</span>
          <strong className="mt-2 block text-2xl tabular-nums">{upcoming.length}</strong>
          <small style={{ color: "var(--ink-secondary)" }}>kvar den här veckan</small>
        </Link>
        <Link href="#att-gora" className="core-panel p-4 md:p-5">
          <span className="caption" style={{ color: "var(--ink-muted)" }}>Underbemannade</span>
          <strong className="mt-2 block text-2xl tabular-nums" style={{ color: understaffed.length ? "var(--warning)" : "var(--ink)" }}>{understaffed.length}</strong>
          <small style={{ color: "var(--ink-secondary)" }}>färre än 9 klara</small>
        </Link>
        <Link href="#att-gora" className="core-panel p-4 md:p-5">
          <span className="caption" style={{ color: "var(--ink-muted)" }}>Inväntar svar</span>
          <strong className="mt-2 block text-2xl tabular-nums">{unanswered}</strong>
          <small style={{ color: "var(--ink-secondary)" }}>spelarsvar för Gul</small>
        </Link>
        <Link href="#belastning" className="core-panel p-4 md:p-5">
          <span className="caption" style={{ color: "var(--ink-muted)" }}>Hög belastning</span>
          <strong className="mt-2 block text-2xl tabular-nums" style={{ color: highLoad.length ? "var(--warning)" : "var(--ink)" }}>{highLoad.length}</strong>
          <small style={{ color: "var(--ink-secondary)" }}>minst 3 matcher ±7 dagar</small>
        </Link>
      </section>

      {(understaffed.length > 0 || unanswered > 0 || pendingEvaluations.length > 0) && <section id="att-gora">
        <div className="core-section-head">
          <h2 className="core-section-title">Att göra</h2>
          <span className="core-section-note">Prioriterat just nu</span>
        </div>
        <div className="core-action-list">
          {understaffed.map(({ activity, ready, missing }) => (
            <Link key={`staff-${activity.id}`} href={`/observera?aktivitet=${encodeURIComponent(activity.id)}`} className="core-action-card">
              <span className="core-action-index">Trupp</span>
              <span><strong>{activity.source_team} mot {activity.title.replace(/^(Match mot|Hemma mot|Borta mot)\s+/i, "")}</strong><small>{ready} klara · saknar {missing} till 9</small></span>
              <span className="core-chevron" aria-hidden>›</span>
            </Link>
          ))}
          {pendingEvaluations.map((evaluation) => (
            <Link key={`eval-${evaluation.id}`} href={`/matcher/${evaluation.id}/utvardera`} className="core-action-card">
              <span className="core-action-index">Efter</span>
              <span><strong>Utvärdera matchen mot {evaluation.opponent}</strong><small>{evaluation.evaluated} av {evaluation.total} spelare klara</small></span>
              <span className="core-chevron" aria-hidden>›</span>
            </Link>
          ))}
        </div>
      </section>}

      {upcoming.length > 0 ? (
        <section id="veckans-matcher">
          <div className="core-section-head">
            <div>
              <p className="core-section-eyebrow">Gul och Grön</p>
              <h2 className="core-section-title">Den här veckan</h2>
            </div>
            <Link href="/uttagning" className="btn-secondary btn-sm">Öppna uttagning</Link>
          </div>
          <div className="core-list core-list-2">
            {upcoming.map((activity) => (
              <CoreActivityCard
                key={activity.id}
                activity={activity}
                href={`/observera?aktivitet=${encodeURIComponent(activity.id)}`}
              />
            ))}
          </div>
        </section>
      ) : (
        <section className="core-panel p-6">
          <h2>Inga fler matcher den här veckan</h2>
          <p className="body mt-2" style={{ color: "var(--ink-secondary)" }}>
            När nya matcher läggs in visas de här.
          </p>
        </section>
      )}

      <section id="belastning">
        <div className="core-section-head">
          <div>
            <p className="core-section-eyebrow">Gulspelare</p>
            <h2 className="core-section-title">Belastning ±7 dagar</h2>
          </div>
          <span className="core-section-note">Spelade och planerade matcher</span>
        </div>
        <div className="core-panel divide-y" style={{ borderColor: "var(--border)" }}>
          {playerLoads.map((player) => (
            <Link key={player.playerId} href={`/spelare/${player.playerId}`} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1"><strong className="block truncate">{player.name}</strong><small style={{ color: "var(--ink-muted)" }}>{player.recentMatches.length} spelade · {player.upcomingMatches.length} planerade</small></span>
              <strong className="tabular-nums" style={{ color: player.windowMatchCount >= 3 ? "var(--warning)" : "var(--ink)" }}>{player.windowMatchCount} {player.windowMatchCount === 1 ? "match" : "matcher"}</strong>
              <span className="core-chevron" aria-hidden>›</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="core-context-banner" data-tone="review">
        <div>
          <strong>Spelade matcher och utvärderingar</strong>
          <p>Matchhistorik och efterarbete finns samlat under Observera.</p>
        </div>
        <Link href="/observera" className="btn-secondary btn-sm">Öppna Observera</Link>
      </section>
    </div>
  );
}
