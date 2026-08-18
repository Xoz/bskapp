import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { getActivityDetail, getCoreActivities, type Evidence } from "@/lib/developmentCore";
import { saveActivityContext, saveQuickObservations } from "@/lib/coreActions";
import CoreActivityCard from "@/components/CoreActivityCard";
import PilotStartField from "@/components/PilotStartField";

export const dynamic = "force-dynamic";

const EVIDENCE: Array<{ value: Evidence; label: string; help: string }> = [
  { value: "shown", label: "Visade", help: "Beteendet syntes tydligt" },
  { value: "practicing", label: "Tränar på", help: "Försökte och är på väg" },
  { value: "revisit", label: "Nytt tillfälle", help: "Behöver observeras igen" },
];

export default async function ObservePage({
  searchParams,
}: {
  searchParams: Promise<{ aktivitet?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.primaryRole)) redirect("/mina-spelare");
  if (!user.permissions.includes("manage_evaluations")) redirect("/idag?behorighet=saknas");
  const { aktivitet } = await searchParams;

  if (!aktivitet) {
    const activities = await getCoreActivities(80);
    return (
      <div className="space-y-6">
        <header>
          <p className="eyebrow">Snabb registrering</p>
          <h1 className="mt-1">Observera</h1>
          <p className="body mt-2" style={{ color: "var(--ink-secondary)" }}>
            Välj en aktivitet. Kalender och närvaro ligger kvar i Svenska Lag.
          </p>
        </header>
        <div className="grid md:grid-cols-2 gap-3">
          {activities.map((activity) => (
            <CoreActivityCard
              key={activity.id}
              activity={activity}
              href={`/observera?aktivitet=${encodeURIComponent(activity.id)}`}
            />
          ))}
        </div>
      </div>
    );
  }

  const detail = await getActivityDetail(aktivitet);
  if (!detail) redirect("/observera");
  const playersWithGoals = detail.players.filter((row) => row.goals.length > 0);
  const contextAction = saveActivityContext.bind(null, detail.activity.id);
  const observationAction = saveQuickObservations.bind(null, detail.activity.id);

  return (
    <div className="space-y-7">
      <header>
        <Link href="/observera" className="caption">← Alla aktiviteter</Link>
        <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="eyebrow">{detail.activity.activity_type === "training" ? "Träning" : detail.activity.activity_type === "match" ? "Match" : "Aktivitet"}</p>
            <h1 className="mt-1">{detail.activity.title}</h1>
            <p className="body-small mt-2" style={{ color: "var(--ink-secondary)" }}>
              {detail.activity.activity_date}{detail.activity.start_time ? ` · ${detail.activity.start_time}` : ""}
            </p>
          </div>
          {detail.activity.activity_type === "match" && (
            <Link href={`/uttagning?aktivitet=${encodeURIComponent(detail.activity.id)}`} className="btn-secondary">
              Till uttagningen
            </Link>
          )}
        </div>
      </header>

      <form action={contextAction} className="card p-5 grid md:grid-cols-[1fr_220px_auto] gap-4 items-end">
        <label className="block">
          <span className="label">Aktivitetens fokus</span>
          <input name="theme" className="input mt-1" defaultValue={detail.activity.theme} placeholder="Exempel: spelbarhet före mottagning" />
        </label>
        <label className="block">
          <span className="label">Miljö</span>
          <select name="challenge_context" className="input mt-1" defaultValue={detail.activity.challenge_context}>
            <option value="safe">Trygg</option>
            <option value="balanced">Balanserad</option>
            <option value="challenging">Utmanande</option>
          </select>
        </label>
        <button type="submit" className="btn-secondary">Spara fokus</button>
      </form>

      <section>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p className="eyebrow">Målanknuten evidens</p>
            <h2 className="mt-1">Vad såg ni?</h2>
          </div>
          <span className="caption" style={{ color: "var(--ink-muted)" }}>Markera bara det som faktiskt observerades</span>
        </div>

        {playersWithGoals.length === 0 ? (
          <div className="card p-6 mt-3">
            <h3>Inga aktiva utvecklingsmål ännu</h3>
            <p className="body-small mt-2" style={{ color: "var(--ink-secondary)" }}>
              Sätt högst två mål på spelarsidan innan observationer registreras.
            </p>
            <Link href="/spelare" className="btn-primary mt-4">Öppna spelarna</Link>
          </div>
        ) : (
          <form action={observationAction} className="mt-3 space-y-3">
            <PilotStartField />
            {playersWithGoals.map(({ player, goals }) => (
              <article key={player.id} className="card p-4 md:p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h3>{player.name}</h3>
                    <select name={`goal_${player.id}`} className="input mt-2" defaultValue={goals[0]?.id}>
                      {goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
                    </select>
                  </div>
                  <Link href={`/spelare/${player.id}`} className="caption">Spelarprofil →</Link>
                </div>
                <div className="grid sm:grid-cols-3 gap-2 mt-4">
                  {EVIDENCE.map((option) => (
                    <label key={option.value} className="rounded-xl p-3 cursor-pointer" style={{ border: "1px solid var(--border)", background: "var(--elevated)" }}>
                      <span className="flex items-center gap-2 font-semibold">
                        <input type="radio" name={`evidence_${player.id}`} value={option.value} />
                        {option.label}
                      </span>
                      <span className="caption block mt-1" style={{ color: "var(--ink-muted)" }}>{option.help}</span>
                    </label>
                  ))}
                </div>
                <input name={`note_${player.id}`} className="input mt-3" placeholder="Kort konkret exempel, frivilligt" maxLength={280} />
              </article>
            ))}
            <div className="sticky bottom-20 md:bottom-4 flex justify-end">
              <button type="submit" className="btn-primary shadow-lg">Spara markerade observationer</button>
            </div>
          </form>
        )}
      </section>

      {detail.observations.length > 0 && (
        <section>
          <h2>Redan registrerat</h2>
          <div className="space-y-2 mt-3">
            {detail.observations.map((observation) => (
              <div key={observation.id} className="card p-4 flex items-start justify-between gap-3">
                <div>
                  <strong>{observation.player_name}</strong>
                  <p className="body-small mt-1">{observation.goal_title}</p>
                  {observation.note && <p className="body-small mt-1" style={{ color: "var(--ink-secondary)" }}>{observation.note}</p>}
                </div>
                <span className="badge">{evidenceLabel(observation.evidence)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function evidenceLabel(value: Evidence) {
  return EVIDENCE.find((option) => option.value === value)?.label ?? value;
}
