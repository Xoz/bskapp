import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { getCoreHome } from "@/lib/developmentCore";
import { syncDevelopmentSources } from "@/lib/coreActions";
import { getPendingMatchEvaluation } from "@/lib/matchEvaluation";
import CoreActivityCard from "@/components/CoreActivityCard";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.primaryRole)) redirect("/mina-spelare");
  const [{ nextActivity, upcoming, recent, metrics }, pendingEvaluation] = await Promise.all([
    getCoreHome(),
    getPendingMatchEvaluation(),
  ]);
  const canSync = user.permissions.includes("manage_evaluations");

  return (
    <div className="core-page">
      <header className="core-header">
        <div className="core-header-copy">
          <p className="core-kicker">Utvecklingsverktyget</p>
          <h1 className="core-title">Idag</h1>
          <p className="core-lead">
            Välj fokus, observera det som händer och använd historiken när nästa trupp tas ut.
          </p>
        </div>
        {canSync && (
          <form action={syncDevelopmentSources}>
            <button className="btn-secondary btn-sm" type="submit">Synka Svenska Lag-data</button>
          </form>
        )}
      </header>

      {pendingEvaluation && (
        <Link href={`/matcher/${pendingEvaluation.id}/utvardera`} className="core-panel p-5 flex items-center justify-between gap-4 core-activity-card">
          <div>
            <p className="core-kicker">Efter matchen</p>
            <h2 className="core-section-title mt-2">Utvärdera matchen mot {pendingEvaluation.opponent}</h2>
            <p className="body-small mt-1" style={{ color: "var(--ink-secondary)" }}>
              {pendingEvaluation.evaluated} av {pendingEvaluation.total} spelare klara
            </p>
          </div>
          <span className="badge badge-primary">{pendingEvaluation.evaluated ? "Fortsätt" : "Starta"}</span>
        </Link>
      )}

      {nextActivity ? (
        <section className="core-hero">
          <div>
            <p className="core-kicker">Nästa aktivitet</p>
            <h2 className="core-hero-title">{nextActivity.title}</h2>
            <p className="core-hero-meta">
              <span>{nextActivity.activity_date}</span>
              {nextActivity.start_time && <span>{nextActivity.start_time}</span>}
            </p>
            <p className="core-focus">
              {nextActivity.theme ? nextActivity.theme : "Fokus är inte satt ännu"}
            </p>
          </div>
          <div className="core-actions">
            <Link href={`/observera?aktivitet=${encodeURIComponent(nextActivity.id)}`} className="btn-primary">
              Förbered observation
            </Link>
            {nextActivity.activity_type === "match" && (
              <Link href={`/uttagning?aktivitet=${encodeURIComponent(nextActivity.id)}`} className="btn-secondary">
                Öppna uttagning
              </Link>
            )}
          </div>
        </section>
      ) : (
        <section className="card p-6">
          <h2>Inga aktiviteter är synkade</h2>
          <p className="body mt-2" style={{ color: "var(--ink-secondary)" }}>
            Synka befintlig kalender och senaste närvaroimport. Svenska Lag fortsätter vara källan.
          </p>
        </section>
      )}

      <section>
        <div className="core-section-head">
          <h2 className="core-section-title">Kärnloopen · 28 dagar</h2>
          <span className="core-section-note">Mål: 80 % mål · 75 % aktiviteter</span>
        </div>
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
      </section>

      {upcoming.length > 1 && (
        <section>
          <div className="core-section-head"><h2 className="core-section-title">Kommande</h2><span className="core-section-note">Från Svenska Lag</span></div>
          <div className="core-list core-list-2">
            {upcoming.slice(1).map((activity) => (
              <CoreActivityCard
                key={activity.id}
                activity={activity}
                href={`/observera?aktivitet=${encodeURIComponent(activity.id)}`}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="core-section-head">
          <h2 className="core-section-title">Senaste aktiviteter</h2>
          <Link href="/observera" className="btn-secondary btn-sm">Alla aktiviteter</Link>
        </div>
        <div className="core-list core-list-2">
          {recent.map((activity) => (
            <CoreActivityCard
              key={activity.id}
              activity={activity}
              href={`/observera?aktivitet=${encodeURIComponent(activity.id)}`}
            />
          ))}
        </div>
      </section>
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
