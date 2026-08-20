import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { getCoreHome } from "@/lib/developmentCore";
import { getPendingMatchEvaluation } from "@/lib/matchEvaluation";
import CoreActivityCard from "@/components/CoreActivityCard";
import { sanktanLevelLabel } from "@/lib/sanktanLevel";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.primaryRole)) redirect("/mina-spelare");
  const [{ nextActivity, upcoming, recent, metrics }, pendingEvaluation] = await Promise.all([
    getCoreHome(),
    getPendingMatchEvaluation(),
  ]);
  const nextAccepted = Number(nextActivity?.accepted_callup_count ?? 0);
  const nextCalled = nextAccepted
    + Number(nextActivity?.declined_callup_count ?? 0)
    + Number(nextActivity?.pending_callup_count ?? 0);
  const nextNeedsPlayers = nextActivity?.activity_type === "match" && nextAccepted < 9;
  const nextSanktanMatches = upcoming
    .filter((activity) => activity.external_source === "svenskalag_sanktan" && activity.id !== nextActivity?.id)
    .slice(0, 4);

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
      </header>

      {nextActivity ? (
        <section className="core-hero">
          <div>
            <p className="core-kicker">Nästa aktivitet</p>
            <h2 className="core-hero-title">{nextActivity.title}</h2>
            <p className="core-hero-meta">
              <span>{nextActivity.activity_date}</span>
              {nextActivity.start_time && <span>{nextActivity.start_time}</span>}
            </p>
            <div className="core-hero-tags">
              {nextActivity.source_team && <span className="core-team-tag" data-team-tone={nextActivity.source_team === "Gul" ? "yellow" : "green"}>{nextActivity.source_team}</span>}
              {nextActivity.competition_level && <span className="badge">{sanktanLevelLabel(nextActivity.competition_level)}</span>}
              {nextActivity.activity_type === "match" && nextCalled > 0 && (
                <span className={`badge ${nextNeedsPlayers ? "core-status-warning" : "core-status-ok"}`}>{nextAccepted} har tackat ja</span>
              )}
            </div>
            <p className="core-focus">
              {nextActivity.theme ? nextActivity.theme : "Fokus är inte satt ännu"}
            </p>
          </div>
          <div className="core-actions">
            <Link href={`/observera?aktivitet=${encodeURIComponent(nextActivity.id)}`} className="btn-primary">
              {nextActivity.theme ? "Öppna matchfokus" : "Sätt matchfokus"}
            </Link>
            {nextActivity.activity_type === "match" && (
              <Link href={`/uttagning?aktivitet=${encodeURIComponent(nextActivity.id)}`} className="btn-secondary">
                Öppna uttagningen
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

      {(pendingEvaluation || nextNeedsPlayers || (nextActivity && !nextActivity.theme)) && <section>
        <div className="core-section-head">
          <h2 className="core-section-title">Att göra</h2>
          <span className="core-section-note">Nästa tydliga steg</span>
        </div>
        <div className="core-action-list">
          {nextNeedsPlayers && nextActivity && (
            <Link href={`/uttagning?aktivitet=${encodeURIComponent(nextActivity.id)}`} className="core-action-card" data-tone="warning">
              <span className="core-action-index">Trupp</span>
              <span><strong>Säkra matchtruppen</strong><small>{nextCalled > 0 ? `${nextAccepted} har tackat ja · ${9 - nextAccepted} saknas` : "Ingen kallelse är synkad ännu"}</small></span>
              <span className="core-chevron" aria-hidden>›</span>
            </Link>
          )}
          {nextActivity && !nextActivity.theme && (
            <Link href={`/observera?aktivitet=${encodeURIComponent(nextActivity.id)}`} className="core-action-card">
              <span className="core-action-index">Fokus</span>
              <span><strong>Sätt ett matchfokus</strong><small>Bestäm vad ni vill titta efter före matchen</small></span>
              <span className="core-chevron" aria-hidden>›</span>
            </Link>
          )}
          {pendingEvaluation && (
            <Link href={`/matcher/${pendingEvaluation.id}/utvardera`} className="core-action-card">
              <span className="core-action-index">Efter</span>
              <span><strong>Utvärdera matchen mot {pendingEvaluation.opponent}</strong><small>{pendingEvaluation.evaluated} av {pendingEvaluation.total} spelare klara</small></span>
              <span className="core-chevron" aria-hidden>›</span>
            </Link>
          )}
        </div>
      </section>}

      {nextSanktanMatches.length > 0 && (
        <section>
          <div className="core-section-head"><h2 className="core-section-title">Nästa Sanktanmatcher</h2><span className="core-section-note">Öppna för att förbereda</span></div>
          <div className="core-list core-list-2">
            {nextSanktanMatches.map((activity) => (
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
          <h2 className="core-section-title">Senast i aktivitetsloggen</h2>
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
