import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { getActivityDetail, getCoreActivities, type Evidence } from "@/lib/developmentCore";
import { saveActivityContext, saveQuickObservations } from "@/lib/coreActions";
import { swedishToday } from "@/lib/dates";
import CoreActivityCard from "@/components/CoreActivityCard";
import PilotStartField from "@/components/PilotStartField";

export const dynamic = "force-dynamic";

const EVIDENCE: Array<{ value: Evidence; label: string; help: string }> = [
  { value: "shown", label: "Visade", help: "Beteendet syntes tydligt" },
  { value: "practicing", label: "Tränar på", help: "Försökte och är på väg" },
  { value: "revisit", label: "Nytt tillfälle", help: "Behöver observeras igen" },
];

function endOfCurrentWeek(date: string) {
  const current = new Date(`${date}T12:00:00Z`);
  const daysUntilSunday = (7 - current.getUTCDay()) % 7;
  current.setUTCDate(current.getUTCDate() + daysUntilSunday);
  return current.toISOString().slice(0, 10);
}

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
    const weekEnd = endOfCurrentWeek(swedishToday());
    const activities = (await getCoreActivities(80, "sanktan"))
      .filter((activity) => !activity.is_upcoming || activity.activity_date <= weekEnd);
    return (
      <div className="core-page">
        <header className="core-header">
          <div className="core-header-copy">
          <p className="core-kicker">Snabb registrering</p>
          <h1 className="core-title">Observera</h1>
          <p className="core-lead">
            Spelade Sanktanmatcher samt den här veckans kommande matcher från Svenska Lag.
          </p>
          </div>
        </header>
        <div className="core-list core-list-2">
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
  const teamTone = detail.activity.source_team === "Gul" ? "yellow" : detail.activity.source_team === "Grön" ? "green" : "blue";
  const isSanktan = detail.activity.external_source === "svenskalag_sanktan";
  const contextAction = saveActivityContext.bind(null, detail.activity.id);
  const observationAction = saveQuickObservations.bind(null, detail.activity.id);

  return (
    <div className="core-page">
      <header>
        <Link href="/observera" className="body-small" style={{ color: "var(--ink-secondary)" }}>← Alla Sanktanmatcher</Link>
        <div className="core-header mt-2">
          <div>
            <p className="core-kicker">{detail.activity.activity_type === "training" ? "Träning" : detail.activity.activity_type === "match" ? "Match" : "Aktivitet"}</p>
            <h1 className="core-title">{detail.activity.title}</h1>
            <p className="core-lead">
              {detail.activity.activity_date}{detail.activity.start_time ? ` · ${detail.activity.start_time}` : ""}
            </p>
            {detail.activity.activity_type === "match" && (
              <div className="flex items-center gap-2 flex-wrap mt-3">
                {detail.activity.source_team && (
                  <span className="core-team-tag" data-team-tone={teamTone}>{detail.activity.source_team}</span>
                )}
                {detail.activity.is_upcoming && <span className="badge badge-primary">Kommande</span>}
                {isSanktan && detail.activity.competition_level && (
                  <span className="badge">Sanktan nivå {detail.activity.competition_level}</span>
                )}
              </div>
            )}
          </div>
          {detail.activity.activity_type === "match" && detail.activity.is_upcoming && (
            <Link href={`/uttagning?aktivitet=${encodeURIComponent(detail.activity.id)}`} className="btn-secondary">
              Till uttagningen
            </Link>
          )}
        </div>
      </header>

      {detail.activity.activity_type === "match" && !detail.activity.is_upcoming && (
        <section className="core-panel core-form-panel">
          <div className="core-section-head">
            <div><p className="core-kicker">Matchtrupp</p><h2 className="core-section-title mt-2">Spelare som spelade</h2></div>
            <span className="core-section-note">{detail.activity.participant_names.length} spelare</span>
          </div>
          {detail.activity.participant_names.length > 0 ? (
            <div className="core-player-chips mt-4">
              {detail.activity.participant_names.map((name) => <span key={name} className="badge">{name}</span>)}
            </div>
          ) : (
            <p className="body-small mt-4" style={{ color: "var(--ink-secondary)" }}>Inga spelare är registrerade på matchen ännu.</p>
          )}
        </section>
      )}

      <form action={contextAction} className="core-panel core-form-panel grid md:grid-cols-[1fr_220px_auto] gap-4 items-end">
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

      {!detail.activity.is_upcoming && <section>
        <div className="core-section-head">
          <div><p className="core-kicker">Målanknuten evidens</p><h2 className="core-section-title mt-2">Vad såg ni?</h2></div>
          <span className="core-section-note">Markera bara det som faktiskt observerades</span>
        </div>

        {playersWithGoals.length === 0 ? (
          <div className="core-panel core-form-panel">
            <h3>Inga aktiva utvecklingsmål ännu</h3>
            <p className="body-small mt-2" style={{ color: "var(--ink-secondary)" }}>
              Sätt högst två mål på spelarsidan innan observationer registreras.
            </p>
            <Link href="/spelare" className="btn-primary mt-4">Öppna spelarna</Link>
          </div>
        ) : (
          <form action={observationAction} className="core-list">
            <PilotStartField />
            {playersWithGoals.map(({ player, goals }) => (
              <article key={player.id} className="core-selection-card">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="core-player-name">{player.name}</h3>
                    <select name={`goal_${player.id}`} className="input mt-2" defaultValue={goals[0]?.id}>
                      {goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
                    </select>
                  </div>
                  <Link href={`/spelare/${player.id}`} className="caption">Spelarprofil →</Link>
                </div>
                <div className="grid sm:grid-cols-3 gap-2 mt-4">
                  {EVIDENCE.map((option) => (
                    <label key={option.value} className="core-choice">
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
      </section>}

      {detail.observations.length > 0 && (
        <section>
          <div className="core-section-head"><h2 className="core-section-title">Redan registrerat</h2></div>
          <div className="core-list">
            {detail.observations.map((observation) => (
              <div key={observation.id} className="core-panel p-4 flex items-start justify-between gap-3">
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
