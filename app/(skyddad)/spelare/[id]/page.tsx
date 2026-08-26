import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { getPlayerCore } from "@/lib/developmentCore";
import { closeDevelopmentGoal, createDevelopmentGoal, createPlayerConversation, savePlayerSelectionPreferences } from "@/lib/coreActions";
import { getLatestDevelopmentCheckpoint, getPlayerConversations, getPlayerSkillStatuses } from "@/lib/queries";
import { swedishToday } from "@/lib/dates";
import Avatar from "@/components/Avatar";
import PilotStartField from "@/components/PilotStartField";
import PlayerSelectionPreferencesForm from "@/components/PlayerSelectionPreferencesForm";
import { IconArrowLeft } from "@/components/Icons";
import { sanktanLevelLabel } from "@/lib/sanktanLevel";
import { getPlayerMatchEvaluationTrend } from "@/lib/matchEvaluation";
import MatchEvaluationTrend from "@/components/MatchEvaluationTrend";
import { totalProgress } from "@/lib/skillTrappan";

export const dynamic = "force-dynamic";
function formatMatchDate(value: string | Date) {
  const date = value instanceof Date
    ? value
    : new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short", year: "numeric" })
    .format(date);
}

export default async function PlayerPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mal?: string; samtal?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.primaryRole)) redirect("/mina-spelare");
  const { id } = await params;
  const playerId = Number(id);
  if (!Number.isInteger(playerId)) notFound();
  const canViewPrivate = user.permissions.includes("view_private_player_data");
  const [core, matchEvaluationTrend, skillStatuses, latestDevelopmentUpdate, conversations] = await Promise.all([
    getPlayerCore(playerId),
    getPlayerMatchEvaluationTrend(playerId),
    getPlayerSkillStatuses(playerId),
    getLatestDevelopmentCheckpoint(playerId),
    canViewPrivate ? getPlayerConversations(playerId) : Promise.resolve([]),
  ]);
  if (!core) notFound();
  const { mal, samtal } = await searchParams;
  const { summary, goalHistory, matchHistory } = core;
  const canEdit = user.permissions.includes("manage_evaluations");
  const canSetSelectionPreferences = user.permissions.includes("manage_squads");
  const addGoal = createDevelopmentGoal.bind(null, playerId);
  const savePreferences = savePlayerSelectionPreferences.bind(null, playerId);
  const saveConversation = createPlayerConversation.bind(null, playerId);
  const positionSummary = summary.player.preferred_position_primary || summary.player.position || "";
  const normalLevel = sanktanLevelLabel(Number(summary.player.preferred_level_primary));
  const challengeLevel = sanktanLevelLabel(Number(summary.player.preferred_level_secondary));
  const levelSummary = normalLevel
    ? `Normal: ${normalLevel}${challengeLevel ? ` · Utmaning: ${challengeLevel}` : ""}`
    : "";
  const assessmentMeta = summary.player.level_assessed_at
    ? `Senast bedömd ${formatMatchDate(summary.player.level_assessed_at)}${summary.player.level_assessed_by ? ` av ${summary.player.level_assessed_by}` : ""}`
    : "Ingen daterad nivåbedömning ännu";
  const treeProgress = totalProgress(skillStatuses);
  const activeTreeSteps = Object.values(skillStatuses).filter((status) => status === "training" || status === "almost").length;
  const hasTreeStatus = Object.keys(skillStatuses).length > 0;

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
            <span>{summary.callupCount} kallelser</span>
          </div>
          <div className="player-profile-quickfacts">
            {summary.teams.map((team) => <span key={team.id} className="core-team-tag" data-team-tone={team.name === "Gul" ? "yellow" : team.name === "Grön" ? "green" : "blue"}>{team.name}</span>)}
            <span>{positionSummary ? `Position: ${positionSummary}` : "Position saknas"}</span>
            <span>{levelSummary ? `Nivå: ${levelSummary}` : "Nivå saknas"}</span>
          </div>
        </div>
        <Link href={`/spelare/${playerId}/utveckling`} className="btn-secondary btn-sm">Utvecklingsträd</Link>
      </header>

      <section className="core-panel core-form-panel">
        <div className="core-section-head">
          <div>
            <p className="core-kicker">Utvecklingsträd</p>
            <h2 className="core-section-title mt-2">Långsiktig utvecklingsbild</h2>
          </div>
          <Link href={`/spelare/${playerId}/utveckling`} className="btn-primary btn-sm">Öppna trädet</Link>
        </div>
        <p className="body-small max-w-2xl" style={{ color: "var(--ink-secondary)" }}>
          Följ spelarens färdigheter över tid och håll aktuellt fokus samlat på ett ställe.
        </p>
        <div className="core-statline">
          <span>{hasTreeStatus ? `${activeTreeSteps} steg i arbete` : "Trädet är inte påbörjat"}</span>
          {hasTreeStatus && <span>{treeProgress.done} av {treeProgress.total} steg behärskade</span>}
          <span>{latestDevelopmentUpdate ? `Senast uppdaterat ${latestDevelopmentUpdate.date}` : "Ingen sparad historik"}</span>
        </div>
      </section>

      {canViewPrivate && <details className="core-panel core-form-panel" open={samtal === "tomt"}>
        <summary className="core-section-head cursor-pointer list-none">
          <div>
            <p className="core-kicker">Spelarsamtal</p>
            <h2 className="core-section-title mt-2">Samtal och överenskommelser</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="core-section-note">{conversations.length} sparade</span>
            <span aria-hidden="true" className="text-xl leading-none" style={{ color: "var(--ink-muted)" }}>⌄</span>
          </div>
        </summary>
        {samtal === "sparat" && (
          <p className="mt-3 rounded-xl p-3 body-small" style={{ background: "var(--ok-bg)" }}>
            Spelarsamtalet är sparat.
          </p>
        )}
        {samtal === "tomt" && (
          <p className="mt-3 rounded-xl p-3 body-small" style={{ background: "var(--danger-bg)" }}>
            Skriv minst en samtalsanteckning innan du sparar.
          </p>
        )}
        {canEdit && (
          <form action={saveConversation} className="grid md:grid-cols-2 gap-4 mt-5">
            <label>
              <span className="label">Samtalsdatum</span>
              <input name="conversation_date" type="date" defaultValue={swedishToday()} required className="input mt-1" />
            </label>
            <label>
              <span className="label">Följ upp</span>
              <input name="follow_up_on" type="date" className="input mt-1" />
            </label>
            <label className="md:col-span-2">
              <span className="label">Tränarens sammanfattning</span>
              <textarea name="coach_summary" rows={3} maxLength={4000} className="input mt-1" placeholder="Vad tog ni upp och vad är tränarens bild?" />
            </label>
            <label className="md:col-span-2">
              <span className="label">Spelarens perspektiv</span>
              <textarea name="player_perspective" rows={3} maxLength={4000} className="input mt-1" placeholder="Vad uttryckte spelaren om trivsel, motivation och sin utveckling?" />
            </label>
            <label className="md:col-span-2">
              <span className="label">Överenskomna nästa steg</span>
              <textarea name="agreed_actions" rows={3} maxLength={4000} className="input mt-1" placeholder="Vad ska spelaren och tränarna göra fram till uppföljningen?" />
            </label>
            <div className="md:col-span-2 flex items-center gap-3 flex-wrap">
              <button type="submit" className="btn-primary">Spara spelarsamtal</button>
              <span className="caption" style={{ color: "var(--ink-muted)" }}>
                Samtalet sparas separat från utvecklingsträdet.
              </span>
            </div>
          </form>
        )}
        {conversations.length > 0 && (
          <div className="space-y-3 mt-5">
            {conversations.map((conversation) => (
              <article key={conversation.id} className="core-panel p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h3>{formatMatchDate(conversation.conversation_date)}</h3>
                  <span className="caption" style={{ color: "var(--ink-muted)" }}>
                    {conversation.coach_name || "Tränare"}
                    {conversation.follow_up_on ? ` · följ upp ${formatMatchDate(conversation.follow_up_on)}` : ""}
                  </span>
                </div>
                <div className="space-y-2 mt-3">
                  {conversation.coach_summary && <p className="body-small whitespace-pre-wrap"><strong>Tränarens sammanfattning:</strong> {conversation.coach_summary}</p>}
                  {conversation.player_perspective && <p className="body-small whitespace-pre-wrap"><strong>Spelarens perspektiv:</strong> {conversation.player_perspective}</p>}
                  {conversation.agreed_actions && <p className="body-small whitespace-pre-wrap"><strong>Nästa steg:</strong> {conversation.agreed_actions}</p>}
                </div>
              </article>
            ))}
          </div>
        )}
      </details>}

      <details className="core-panel core-form-panel">
        <summary className="core-section-head cursor-pointer list-none">
          <div><p className="core-kicker">Tränarbedömning</p><h2 className="core-section-title mt-2">Primär position och Sanktan-nivå</h2></div>
          <div className="flex items-center gap-3"><span className="core-section-note">{positionSummary || "Position saknas"} · {levelSummary || "Nivå saknas"}</span><span aria-hidden="true" className="text-xl leading-none" style={{ color: "var(--ink-muted)" }}>⌄</span></div>
        </summary>
        {canSetSelectionPreferences ? (
          <>
            <PlayerSelectionPreferencesForm action={savePreferences} defaults={{
              positionPrimary: summary.player.preferred_position_primary,
              positionSecondary: summary.player.preferred_position_secondary,
              levelPrimary: summary.player.preferred_level_primary,
              levelSecondary: summary.player.preferred_level_secondary,
              selectionEligible: Boolean(summary.player.selection_eligible),
            }} />
            <p className="caption mt-3" style={{ color: "var(--ink-muted)" }}>{assessmentMeta}</p>
          </>
        ) : (
          <div className="core-player-chips mt-4">
            <span className="badge">Primär position: {positionSummary || "Ej satt"}</span>
            <span className="badge">Normal nivå: {normalLevel || "Ej satt"}</span>
            <span className="badge">Utmaningsnivå: {challengeLevel || "Ej satt"}</span>
            <span className="badge">Uttagning: {summary.player.selection_eligible ? "Kan föreslås" : "Ej tillgänglig"}</span>
          </div>
        )}
      </details>

      <details className="core-panel core-form-panel" open>
        <summary className="core-section-head cursor-pointer list-none">
          <div><p className="core-kicker">Fokus</p><h2 className="core-section-title mt-2">Aktiva utvecklingsmål</h2></div>
          <div className="flex items-center gap-3"><span className="core-section-note">{summary.goals.length}/2 aktiva</span><span aria-hidden="true" className="text-xl leading-none" style={{ color: "var(--ink-muted)" }}>⌄</span></div>
        </summary>
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
      </details>

      {goalHistory.some((goal) => goal.status !== "active") && <details className="core-panel core-form-panel"><summary className="font-semibold cursor-pointer list-none flex items-center justify-between"><span>Tidigare mål</span><span aria-hidden="true" style={{ color: "var(--ink-muted)" }}>⌄</span></summary><div className="space-y-2 mt-4">{goalHistory.filter((goal) => goal.status !== "active").map((goal) => <p key={goal.id} className="body-small"><span className="badge mr-2">{goal.status === "achieved" ? "Uppnått" : "Pausat"}</span>{goal.title}</p>)}</div></details>}

      <MatchEvaluationTrend data={matchEvaluationTrend} />

      <details className="core-panel core-form-panel">
        <summary className="core-section-head cursor-pointer list-none">
          <div><p className="core-kicker">Sanktan</p><h2 className="core-section-title mt-2">Spelade matcher</h2></div>
          <div className="flex items-center gap-3"><span className="core-section-note">{matchHistory.length} spelade</span><span aria-hidden="true" className="text-xl leading-none" style={{ color: "var(--ink-muted)" }}>⌄</span></div>
        </summary>
        {matchHistory.length ? (
          <div className="core-list core-list-2 mt-4">
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
          <div className="core-panel p-5 mt-4"><p className="body-small" style={{ color: "var(--ink-secondary)" }}>Inga spelade Sanktanmatcher registrerade.</p></div>
        )}
      </details>
    </div>
  );
}
