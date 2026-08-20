import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { getCoreHome } from "@/lib/developmentCore";
import { getPendingMatchEvaluation } from "@/lib/matchEvaluation";
import CoreActivityCard from "@/components/CoreActivityCard";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.primaryRole)) redirect("/mina-spelare");
  const [{ upcoming, recent, metrics }, pendingEvaluation] = await Promise.all([
    getCoreHome(),
    getPendingMatchEvaluation(),
  ]);

  return (
    <div className="core-page">
      <header className="core-header">
        <div className="core-header-copy">
          <p className="core-kicker">Utvecklingsverktyget</p>
          <h1 className="core-title">Idag</h1>
          <p className="core-lead">
            Veckans gula Sanktanmatcher, kallelseläget och det som behöver följas upp.
          </p>
        </div>
      </header>

      {upcoming.length > 0 ? (
        <section>
          <div className="core-section-head">
            <div>
              <p className="core-section-eyebrow">Gul · Sanktan</p>
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
          <h2>Inga fler gula Sanktanmatcher den här veckan</h2>
          <p className="body mt-2" style={{ color: "var(--ink-secondary)" }}>
            När nya matcher har hämtats från Svenska Lag visas de här.
          </p>
        </section>
      )}

      {pendingEvaluation && <section>
        <div className="core-section-head">
          <h2 className="core-section-title">Att göra</h2>
          <span className="core-section-note">Nästa tydliga steg</span>
        </div>
        <div className="core-action-list">
          <Link href={`/matcher/${pendingEvaluation.id}/utvardera`} className="core-action-card">
            <span className="core-action-index">Efter</span>
            <span><strong>Utvärdera matchen mot {pendingEvaluation.opponent}</strong><small>{pendingEvaluation.evaluated} av {pendingEvaluation.total} spelare klara</small></span>
            <span className="core-chevron" aria-hidden>›</span>
          </Link>
        </div>
      </section>}

      <section>
        <div className="core-section-head">
          <div>
            <p className="core-section-eyebrow">Gul · Sanktan</p>
            <h2 className="core-section-title">Senaste matcher</h2>
          </div>
          <Link href="/observera" className="btn-secondary btn-sm">Visa historik</Link>
        </div>
        {recent.length > 0 ? (
          <div className="core-list core-list-2">
            {recent.map((activity) => (
              <CoreActivityCard
                key={activity.id}
                activity={activity}
                href={`/observera?aktivitet=${encodeURIComponent(activity.id)}`}
              />
            ))}
          </div>
        ) : (
          <p className="core-section-note">Inga spelade gula Sanktanmatcher finns i historiken ännu.</p>
        )}
      </section>

      <details className="core-insights">
        <summary>
          <span><strong>Uppföljning senaste 28 dagar</strong><small>Mål, observationer och sparade uttagningar</small></span>
          <span aria-hidden="true">⌄</span>
        </summary>
        <div className="core-metrics">
          <Metric label="Spelare med mål" value={`${metrics.goalCoveragePercent}%`} detail={`${metrics.playersWithGoals}/${metrics.playerCount}`} />
          <Metric label="Observerade aktiviteter" value={`${metrics.observedActivityPercent}%`} detail={`${metrics.observedActivityCount}/${metrics.recentActivityCount}`} />
          <Metric label="Sparade uttagningar" value={String(metrics.selectionCount)} detail="matchtillfällen" />
          <Metric
            label="Under två minuter"
            value={metrics.observationUnderTwoMinutesPercent == null ? "–" : `${metrics.observationUnderTwoMinutesPercent}%`}
            detail={metrics.averageObservationSeconds == null ? "ingen tidmätning ännu" : `snitt ${metrics.averageObservationSeconds} sek`}
          />
        </div>
      </details>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="core-metric">
      <span className="core-metric-label">{label}</span>
      <strong className="core-metric-value">{value}</strong>
      <span className="core-metric-detail">{detail}</span>
    </div>
  );
}
