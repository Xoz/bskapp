import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { getCoreHome } from "@/lib/developmentCore";
import { syncDevelopmentSources } from "@/lib/coreActions";
import CoreActivityCard from "@/components/CoreActivityCard";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.primaryRole)) redirect("/mina-spelare");
  const { nextActivity, upcoming, recent, metrics } = await getCoreHome();
  const canSync = user.permissions.includes("manage_evaluations");

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow">Utvecklingsverktyget</p>
          <h1 className="mt-1" style={{ fontSize: "clamp(34px, 7vw, 52px)" }}>Idag</h1>
          <p className="body mt-2 max-w-2xl" style={{ color: "var(--ink-secondary)" }}>
            Välj fokus, observera det som händer och använd historiken när nästa trupp tas ut.
          </p>
        </div>
        {canSync && (
          <form action={syncDevelopmentSources}>
            <button className="btn-secondary btn-sm" type="submit">Synka Svenska Lag-data</button>
          </form>
        )}
      </header>

      {nextActivity ? (
        <section className="card p-5 md:p-7" style={{ background: "var(--primary-wash)", borderColor: "var(--primary-line)" }}>
          <p className="eyebrow">Nästa aktivitet</p>
          <div className="mt-3 flex items-start justify-between gap-5 flex-wrap">
            <div>
              <h2 style={{ fontSize: "clamp(26px, 5vw, 38px)" }}>{nextActivity.title}</h2>
              <p className="body mt-2" style={{ color: "var(--ink-secondary)" }}>
                {nextActivity.activity_date}{nextActivity.start_time ? ` · ${nextActivity.start_time}` : ""}
              </p>
              <p className="body-small mt-3" style={{ color: "var(--ink-secondary)" }}>
                {nextActivity.theme ? `Fokus: ${nextActivity.theme}` : "Fokus är inte satt ännu"}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Link href={`/observera?aktivitet=${encodeURIComponent(nextActivity.id)}`} className="btn-primary">
                Förbered observation
              </Link>
              {nextActivity.activity_type === "match" && (
                <Link href={`/uttagning?aktivitet=${encodeURIComponent(nextActivity.id)}`} className="btn-secondary">
                  Öppna uttagning
                </Link>
              )}
            </div>
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
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <p className="eyebrow">Pilot, senaste 28 dagarna</p>
            <h2 className="mt-1">Fungerar kärnloopen?</h2>
          </div>
          <span className="caption" style={{ color: "var(--ink-muted)" }}>Mål: 80 % mål · 75 % aktiviteter</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
          <h2>Kommande från källorna</h2>
          <div className="grid md:grid-cols-2 gap-3 mt-3">
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
        <div className="flex items-center justify-between gap-3">
          <h2>Senaste aktiviteter</h2>
          <Link href="/observera" className="btn-secondary btn-sm">Alla aktiviteter</Link>
        </div>
        <div className="grid md:grid-cols-2 gap-3 mt-3">
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
    <div className="card p-4">
      <p className="caption" style={{ color: "var(--ink-muted)" }}>{label}</p>
      <strong className="block mt-2" style={{ fontFamily: "var(--font-display)", fontSize: "30px" }}>{value}</strong>
      <p className="caption mt-1" style={{ color: "var(--ink-secondary)" }}>{detail}</p>
    </div>
  );
}
