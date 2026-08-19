import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { getPlayerCore, type Evidence } from "@/lib/developmentCore";
import { closeDevelopmentGoal, createDevelopmentGoal, savePlayerSelectionPreferences } from "@/lib/coreActions";
import Avatar from "@/components/Avatar";
import PilotStartField from "@/components/PilotStartField";
import { IconArrowLeft } from "@/components/Icons";
import { sanktanLevelLabel } from "@/lib/sanktanLevel";

export const dynamic = "force-dynamic";
const EVIDENCE_LABELS: Record<Evidence, string> = { shown: "Visade", practicing: "Tränar på", revisit: "Nytt tillfälle" };
const POSITION_OPTIONS = ["", "Målvakt", "Back", "Mittfält", "Vänsterkant", "Högerkant", "Anfall"];
const LEVEL_OPTIONS = [
  { value: "", label: "Ej satt" },
  { value: "2", label: "Svår" },
  { value: "3", label: "Medel" },
  { value: "4", label: "Lätt" },
];

function formatMatchDate(value: string) {
  return new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short", year: "numeric" })
    .format(new Date(`${value}T12:00:00`));
}

export default async function PlayerPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mal?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.primaryRole)) redirect("/mina-spelare");
  const { id } = await params;
  const playerId = Number(id);
  if (!Number.isInteger(playerId)) notFound();
  const core = await getPlayerCore(playerId);
  if (!core) notFound();
  const { mal } = await searchParams;
  const { summary, goalHistory, observations, matchHistory } = core;
  const canEdit = user.permissions.includes("manage_evaluations");
  const canSetSelectionPreferences = user.permissions.includes("manage_squads");
  const addGoal = createDevelopmentGoal.bind(null, playerId);
  const savePreferences = savePlayerSelectionPreferences.bind(null, playerId);

  return (
    <div className="core-page">
      <Link href="/spelare" className="inline-flex items-center gap-1.5 body-small" style={{ color: "var(--ink-secondary)" }}>
        <IconArrowLeft width={15} height={15} /> Alla spelare
      </Link>
      <header className="core-panel p-5 md:p-6 flex items-center gap-5 flex-wrap">
        <Avatar name={summary.player.name} jersey={summary.player.jersey_number} size={58} />
        <div className="flex-1 min-w-48">
          <p className="core-kicker">Utvecklingsprofil</p><h1 className="core-title">{summary.player.name}</h1>
          <div className="core-statline">
            <span>{summary.trainingCount} träningar</span>
            <span title={summary.hasSanktanSync ? `Gul ${summary.sanktanGulCount} · Grön ${summary.sanktanGronCount}` : undefined}>
              {summary.matchCount} {summary.hasSanktanSync ? "Sanktanmatcher" : "matcher"}
            </span>
            <span>{summary.callupCount} kallelser</span><span>{summary.periodsPlayed} perioder</span>
          </div>
        </div>
        <Link href={`/spelare/${playerId}/utveckling`} className="btn-secondary btn-sm">Äldre utvecklingsarkiv</Link>
      </header>

      <section className="core-panel core-form-panel">
        <div className="core-section-head">
          <div><p className="core-kicker">Matchpreferenser</p><h2 className="core-section-title mt-2">Position och Sanktan-nivå</h2></div>
          <span className="core-section-note">Första- och andraval</span>
        </div>
        {canSetSelectionPreferences ? (
          <form action={savePreferences} className="grid md:grid-cols-2 gap-4 mt-4">
            <label><span className="label">Position · förstaval</span><select name="preferred_position_primary" className="input mt-1" defaultValue={summary.player.preferred_position_primary}><option value="">Ej satt</option>{POSITION_OPTIONS.slice(1).map((position) => <option key={position} value={position}>{position}</option>)}</select></label>
            <label><span className="label">Position · andraval</span><select name="preferred_position_secondary" className="input mt-1" defaultValue={summary.player.preferred_position_secondary}><option value="">Ej satt</option>{POSITION_OPTIONS.slice(1).map((position) => <option key={position} value={position}>{position}</option>)}</select></label>
            <label><span className="label">Sanktan-nivå · förstaval</span><select name="preferred_level_primary" className="input mt-1" defaultValue={summary.player.preferred_level_primary}>{LEVEL_OPTIONS.map((level) => <option key={level.value || "none"} value={level.value}>{level.label}</option>)}</select></label>
            <label><span className="label">Sanktan-nivå · andraval</span><select name="preferred_level_secondary" className="input mt-1" defaultValue={summary.player.preferred_level_secondary}>{LEVEL_OPTIONS.map((level) => <option key={level.value || "none"} value={level.value}>{level.label}</option>)}</select></label>
            <div className="md:col-span-2 flex justify-end"><button type="submit" className="btn-primary">Spara preferenser</button></div>
          </form>
        ) : (
          <div className="core-player-chips mt-4">
            <span className="badge">Position 1: {summary.player.preferred_position_primary || "Ej satt"}</span>
            <span className="badge">Position 2: {summary.player.preferred_position_secondary || "Ej satt"}</span>
            <span className="badge">Nivå 1: {sanktanLevelLabel(Number(summary.player.preferred_level_primary)) || "Ej satt"}</span>
            <span className="badge">Nivå 2: {sanktanLevelLabel(Number(summary.player.preferred_level_secondary)) || "Ej satt"}</span>
          </div>
        )}
      </section>

      <section>
        <div className="core-section-head">
          <div><p className="core-kicker">Sanktan</p><h2 className="core-section-title mt-2">Matchhistorik</h2></div>
          <span className="core-section-note">{matchHistory.length} spelade</span>
        </div>
        {matchHistory.length ? (
          <div className="core-list core-list-2">
            {matchHistory.map((match) => (
              <article key={match.external_id} className="core-panel p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="core-team-tag" data-team-tone={match.source_team === "Gul" ? "yellow" : "green"}>{match.source_team}</span>
                  {match.level && <span className="badge">Sanktan {sanktanLevelLabel(match.level)}</span>}
                  <span className="caption ml-auto" style={{ color: "var(--ink-muted)" }}>{match.home_away === "home" ? "Hemma" : "Borta"}</span>
                </div>
                <h3 className="mt-3">{match.opponent}</h3>
                <p className="body-small mt-1" style={{ color: "var(--ink-secondary)" }}>
                  {formatMatchDate(match.match_date)}{match.start_time ? ` · ${match.start_time}` : ""}
                </p>
                {match.location && <p className="caption mt-1" style={{ color: "var(--ink-muted)" }}>{match.location}</p>}
              </article>
            ))}
          </div>
        ) : (
          <div className="core-panel p-5"><p className="body-small" style={{ color: "var(--ink-secondary)" }}>Inga spelade Sanktanmatcher registrerade.</p></div>
        )}
      </section>

      <section>
        <div className="core-section-head">
          <div><p className="core-kicker">Fokus</p><h2 className="core-section-title mt-2">Aktiva utvecklingsmål</h2></div>
          <span className="core-section-note">{summary.goals.length}/2 aktiva</span>
        </div>
        {mal === "max" && <p className="mt-3 rounded-xl p-3 body-small" style={{ background: "var(--warn-bg)" }}>Avsluta eller pausa ett mål innan ett nytt läggs till.</p>}
        {mal === "ogiltigt" && <p className="mt-3 rounded-xl p-3 body-small" style={{ background: "var(--danger-bg)" }}>Kontrollera måltexten och datumet.</p>}
        <div className="core-list core-list-2">
          {summary.goals.map((goal) => {
            const closeGoal = closeDevelopmentGoal.bind(null, goal.id);
            return (
              <article key={goal.id} className="core-panel core-form-panel">
                <span className="badge badge-primary">Mål {goal.slot}</span><h3 className="mt-3">{goal.title}</h3>
                {goal.evidence_hint && <p className="body-small mt-2" style={{ color: "var(--ink-secondary)" }}>Leta efter: {goal.evidence_hint}</p>}
                <p className="caption mt-3" style={{ color: "var(--ink-muted)" }}>Start {goal.starts_on}{goal.review_on ? ` · följ upp ${goal.review_on}` : ""}</p>
                {canEdit && <form action={closeGoal} className="flex gap-2 mt-4">
                  <button name="status" value="achieved" className="btn-secondary btn-sm">Uppnått</button>
                  <button name="status" value="paused" className="btn-secondary btn-sm">Pausa</button>
                </form>}
              </article>
            );
          })}
        </div>
        {canEdit && summary.goals.length < 2 && (
          <form action={addGoal} className="core-panel core-form-panel mt-3 grid md:grid-cols-2 gap-4">
            <PilotStartField />
            <div className="md:col-span-2"><p className="core-kicker">Nytt mål</p><h3 className="mt-2">Ett observerbart nästa steg</h3></div>
            <label><span className="label">Utvecklingsmål</span><input name="title" className="input mt-1" required minLength={3} maxLength={120} placeholder="Exempel: söka spelbar yta före mottagning" /></label>
            <label><span className="label">Vad kan tränaren se?</span><input name="evidence_hint" className="input mt-1" maxLength={240} placeholder="Ett konkret beteende, frivilligt" /></label>
            <label><span className="label">Följ upp senast</span><input name="review_on" type="date" className="input mt-1" /></label>
            <div className="flex items-end"><button type="submit" className="btn-primary">Lägg till mål</button></div>
          </form>
        )}
      </section>

      <section>
        <div className="core-section-head"><div><p className="core-kicker">Evidens över tid</p><h2 className="core-section-title mt-2">Observationer</h2></div><Link href="/observera" className="btn-secondary btn-sm">Registrera</Link></div>
        {observations.length ? <div className="core-list">{observations.map((observation) => (
          <article key={observation.id} className="core-panel p-4 flex items-start justify-between gap-4">
            <div><p className="caption" style={{ color: "var(--ink-muted)" }}>{observation.activity_date} · {observation.activity_title}</p><h3 className="mt-1">{observation.goal_title ?? "Generell observation"}</h3>{observation.note && <p className="body-small mt-2" style={{ color: "var(--ink-secondary)" }}>{observation.note}</p>}</div>
            <span className="badge">{EVIDENCE_LABELS[observation.evidence]}</span>
          </article>
        ))}</div> : <div className="core-panel p-5"><p className="body-small" style={{ color: "var(--ink-secondary)" }}>Inga observationer registrerade ännu.</p></div>}
      </section>

      {goalHistory.some((goal) => goal.status !== "active") && <details className="core-panel p-5"><summary className="font-semibold cursor-pointer">Tidigare mål</summary><div className="space-y-2 mt-4">{goalHistory.filter((goal) => goal.status !== "active").map((goal) => <p key={goal.id} className="body-small"><span className="badge mr-2">{goal.status === "achieved" ? "Uppnått" : "Pausat"}</span>{goal.title}</p>)}</div></details>}
    </div>
  );
}
