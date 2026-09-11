import SelectionPolicyForm from "@/components/SelectionPolicyForm";
import {getSelectionEvidence} from "@/lib/selection/data";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, isStaffRole, canAccessPlayer } from "@/lib/auth";
import { all } from "@/lib/db";
import { getPlayerCore } from "@/lib/developmentCore";
import { closeDevelopmentGoal, savePlayerSelectionPreferences } from "@/lib/coreActions";
import { getLatestDevelopmentCheckpoint, getPlayerConversations, getPlayerSkillStatuses } from "@/lib/queries";
import { swedishToday, swedishDateOffset } from "@/lib/dates";
import { getMatchSpaceInputs } from "@/lib/matchSpaceData";
import { playerDirectoryStatsQuery, playerMatchHistoryQuery, type PlayerMatchHistoryRow } from "@/lib/playerDirectoryStats";
import { profileFocus, playerListContext, playerTrainingStatsQuery, type PlayerTrainingStats } from "@/lib/playerProfile";
import { prepareTreeConversation } from "@/lib/treeConversation";
import { sanktanLevelLabel } from "@/lib/sanktanLevel";
import { getPlayerMatchEvaluationTrend } from "@/lib/matchEvaluation";
import { totalProgress, STATUS_LABEL } from "@/lib/skillTrappan";
import Avatar from "@/components/Avatar";
import { IconArrowLeft } from "@/components/Icons";
import MatchSpaceProfile from "@/components/MatchSpaceProfile";
import TreeConversationForm from "@/components/TreeConversationForm";
import PlayerSelectionPreferencesForm from "@/components/PlayerSelectionPreferencesForm";
import MatchEvaluationTrend from "@/components/MatchEvaluationTrend";
import "@/components/player-profile.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Spelarprofil" };
function formatMatchDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Stockholm" }).format(date);
}
const matchTypeLabels: Record<string, string> = { seriespel: "Sanktan", traningsmatch: "Träningsmatch" };
const evidenceLabels = { shown: "Visat i spel", practicing: "Tränar på", revisit: "Att följa upp" };

export default async function PlayerPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mal?: string; samtal?: string; bedomning?: string; lag?: string; q?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.primaryRole)) redirect("/mina-spelare");
  if (!user.permissions.includes("view_players")) redirect("/idag?behorighet=saknas");
  const playerId = Number((await params).id);
  if (!Number.isInteger(playerId) || playerId < 1 || !(await canAccessPlayer(playerId))) notFound();
  const today = swedishToday();
  const year = today.slice(0, 4);
  const canViewPrivate = user.permissions.includes("view_private_player_data");
  const canEdit = user.permissions.includes("manage_evaluations");
  const canSetSelectionPreferences = user.permissions.includes("manage_squads");
  const policyEvidence = canSetSelectionPreferences ? (await getSelectionEvidence([playerId])).get(playerId) : null;
  const statsQuery = playerDirectoryStatsQuery([playerId], today, null);
  const historyQuery = playerMatchHistoryQuery(playerId, today);
  const earlierHistoryQuery = playerMatchHistoryQuery(playerId, today, "earlier");
  const trainingQuery = playerTrainingStatsQuery(playerId, today);
  const [core, matchEvaluationTrend, skillStatuses, latestDevelopmentUpdate, conversations, matchSpaces, statsRows, matchHistory, trainingRows, earlierMatches] = await Promise.all([
    getPlayerCore(playerId), getPlayerMatchEvaluationTrend(playerId), getPlayerSkillStatuses(playerId),
    getLatestDevelopmentCheckpoint(playerId), canViewPrivate ? getPlayerConversations(playerId) : Promise.resolve([]),
    getMatchSpaceInputs([playerId]),
    all<{ match_count: number; callup_count: number }>(statsQuery.sql, statsQuery.args),
    all<PlayerMatchHistoryRow>(historyQuery.sql, historyQuery.args),
    all<PlayerTrainingStats>(trainingQuery.sql, trainingQuery.args),
    all<PlayerMatchHistoryRow>(earlierHistoryQuery.sql, earlierHistoryQuery.args),
  ]);
  if (!core) notFound();
  const { mal, samtal, bedomning, lag, q } = await searchParams;
  const context = playerListContext(lag, q);
  const profileHref = (extra: string) => `/spelare/${playerId}?${context ? `${context}&` : ""}${extra}`;
  const { summary, goalHistory, observations } = core;
  const stats = statsRows[0];
  const training = trainingRows[0];
  const matchSpace = matchSpaces.get(playerId);
  const savePreferences = savePlayerSelectionPreferences.bind(null, playerId);
  const conversationPreparation = prepareTreeConversation(latestDevelopmentUpdate?.id ?? null, latestDevelopmentUpdate?.date ?? null, latestDevelopmentUpdate?.skills ?? []);
  const positionSummary = summary.player.preferred_position_primary || summary.player.position || "";
  const normalLevel = sanktanLevelLabel(Number(summary.player.preferred_level_primary));
  const challengeLevel = sanktanLevelLabel(Number(summary.player.preferred_level_secondary));
  const levelSummary = [normalLevel && `Matchnivå: ${normalLevel}`, challengeLevel && `Utmaning: ${challengeLevel}`].filter(Boolean).join(" · ");
  const assessmentMeta = summary.player.level_assessed_at
    ? `Senast bedömd ${formatMatchDate(summary.player.level_assessed_at)}${summary.player.level_assessed_by ? ` av ${summary.player.level_assessed_by}` : ""}`
    : "Ingen daterad nivåbedömning ännu";
  const treeProgress = totalProgress(skillStatuses);
  const focus = profileFocus(skillStatuses, latestDevelopmentUpdate?.skills ?? []);
  const latestConversation = conversations[0];
  const recentObservations = canViewPrivate ? observations.slice(0, 3) : [];
  const teamsPlayed = [...new Set(matchHistory.map(match => match.source_team || "Utan lagkoppling"))];

  return (
    <div className="core-page player-profile">
      <Link href={`/spelare${context ? `?${context}` : ""}#spelare-${playerId}`} className="profile-back">
        <IconArrowLeft width={16} height={16} /> Alla spelare
      </Link>
      <header className="profile-header">
        <Avatar name={summary.player.name} jersey={summary.player.jersey_number} size={48} />
        <div className="profile-identity">
          <h1>{summary.player.name}</h1>
          <div className="profile-facts">
            {summary.teams.map(team => <span key={team.id} className="core-team-tag" data-team-tone={team.name === "Gul" ? "yellow" : team.name === "Grön" ? "green" : "blue"}>{team.name}</span>)}
            {positionSummary ? <span>{positionSummary}</span> : canSetSelectionPreferences ? <Link href={profileHref("bedomning=1#bedomning")}>Ange position</Link> : <span>Position ej angiven</span>}
          </div>
          <p className="profile-meta">{levelSummary || "Matchnivå ej bedömd"}</p>
        </div>
      </header>

      <section className="core-panel core-form-panel profile-focus" aria-labelledby="focus-title">
        <div className="profile-section-heading">
          <h2 id="focus-title">{focus.explicit ? "Aktuellt fokus" : focus.skills.length ? "Färdigheter i arbete" : "Aktuellt fokus"}</h2>
          <span className="profile-meta">Utvecklingsträdet</span>
        </div>
        {focus.skills.length ? <div className="profile-focus-list">{focus.skills.map(skill => (
          <article key={skill.id}>
            <h3>{skill.title}</h3>
            <p className="profile-meta">{STATUS_LABEL[skillStatuses[skill.id] || "not_started"]}</p>
            <p>{skill.nextStep}</p>
          </article>
        ))}</div> : <p className="profile-empty">Inget fokus valt ännu. Öppna trädet för att beskriva nuläget och välja nästa steg.</p>}
        {canViewPrivate && latestDevelopmentUpdate?.focus_note && <p className="profile-note">{latestDevelopmentUpdate.focus_note}</p>}
        <div className="profile-focus-footer">
          <Link href={`/spelare/${playerId}/utveckling${context ? `?${context}` : ""}`} className="btn-primary btn-sm">Öppna utvecklingsträdet</Link>
          <p className="profile-meta">{latestDevelopmentUpdate ? `Utvecklingsbild ${formatMatchDate(latestDevelopmentUpdate.date)}` : "Ingen sparad utvecklingsbild"}{treeProgress.done > 0 ? ` · ${treeProgress.done} steg behärskade` : ""}</p>
        </div>
      </section>

      {policyEvidence && <SelectionPolicyForm playerId={playerId} evidence={policyEvidence} />}
      {matchSpace && <MatchSpaceProfile key={matchSpace.capacity} playerId={playerId} input={matchSpace} canEdit={canSetSelectionPreferences} />}

      {canViewPrivate && <section className="core-panel core-form-panel" aria-labelledby="followup-title">
        <div className="profile-section-heading"><h2 id="followup-title">Senaste observationer och uppföljning</h2></div>
        {recentObservations.length ? <div className="profile-observations">{recentObservations.map(observation => <article key={observation.id}>
          <p className="profile-meta">{formatMatchDate(observation.activity_date)} · {observation.activity_title}</p>
          <h3>{observation.goal_title || evidenceLabels[observation.evidence]}</h3>
          {observation.note && <p className="profile-note">{observation.note}</p>}
          <p className="profile-meta">{observation.coach_name || "Tränare"} · {evidenceLabels[observation.evidence]}</p>
        </article>)}</div> : <p className="profile-empty">Inga observationer registrerade ännu.</p>}
        {observations.length > 3 && <details className="profile-details"><summary>Visa tidigare observationer ({observations.length - 3})</summary>
          {observations.slice(3).map(observation => <article className="profile-history-row" key={observation.id}><p className="profile-meta">{formatMatchDate(observation.activity_date)} · {observation.activity_title}</p><h3>{observation.goal_title || evidenceLabels[observation.evidence]}</h3><p className="profile-note">{observation.note}</p></article>)}
        </details>}
        <div className="profile-next-step">
          <h3>Överenskommelse från senaste samtalet</h3>
          {latestConversation ? <>
            <p className="profile-note">{latestConversation.agreed_actions || "Ingen överenskommelse noterades."}</p>
            <p className="profile-meta">Samtal {formatMatchDate(latestConversation.conversation_date)}{latestConversation.follow_up_on ? ` · Uppföljningsdatum ${formatMatchDate(latestConversation.follow_up_on)}` : " · Inget uppföljningsdatum valt"}</p>
          </> : <p className="profile-empty">Inget spelarsamtal sparat ännu.</p>}
          {canEdit && <Link href={profileHref("samtal=forbered#samtal")} className="btn-secondary btn-sm">Förbered spelarsamtal</Link>}
        </div>
      </section>}

      {canViewPrivate && <details className="core-panel core-form-panel profile-conversations" id="samtal" open={Boolean(samtal)}>
        <summary className="core-section-head cursor-pointer list-none">
          <div>
            <h2 className="core-section-title">Samtal och överenskommelser</h2>
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
        {canEdit && <TreeConversationForm playerId={playerId} scope={String(user.id)} today={swedishToday()} preparation={conversationPreparation} />}
        {conversations.length > 0 && (
          <div className="space-y-3 mt-5">
            {conversations.map((conversation) => (
              <article key={conversation.id} className="profile-history-row">
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


      <MatchEvaluationTrend data={matchEvaluationTrend} />

      <section className="core-panel core-form-panel" aria-labelledby="stats-title">
        <div className="profile-section-heading"><h2 id="stats-title">Deltagande {year}</h2><span className="profile-meta">Alla lag · utan cuper</span></div>
        <dl className="profile-stats">
          <div><dt>Träningar</dt><dd>{training.training_count}</dd></div>
          <div><dt>Spelade matcher</dt><dd>{stats.match_count}</dd></div>
          <div><dt>Matchkallelser</dt><dd>{stats.callup_count}</dd></div>
        </dl>
        <details className="profile-details"><summary>Vad räknas och vilka lag?</summary>
          <p className="profile-meta">Matchantal avser registrerat deltagande till och med idag. Matchkallelser omfattar årets tidigare och kommande matcher med ja, nej eller obesvarat. Uttagning är inte ett kallelsesvar. Cuper och inställda eller borttagna matcher ingår inte. Träningar avser registrerad närvaro till och med igår. Historiken kan vara ofullständig.</p>
          <ul className="profile-breakdown">{teamsPlayed.map(team => <li key={team}>{team}: {matchHistory.filter(match => (match.source_team || "Utan lagkoppling") === team).length} spelade matcher</li>)}</ul>
        </details>
        <div className="profile-next-step">
          <h3>Träningsnärvaro · senaste 28 dagarna</h3>
          <p className="profile-meta">{formatMatchDate(swedishDateOffset(-28))}–{formatMatchDate(swedishDateOffset(-1))}</p>
          {training.recent_present + training.recent_absent + training.recent_unknown > 0 ? <>
            <p className="profile-attendance"><strong>{training.recent_present}</strong> närvarande · <strong>{training.recent_absent}</strong> frånvarande · <strong>{training.recent_unknown}</strong> ej registrerade</p>
            <p className="profile-meta">Pass med registrerat deltagande eller kallelse för spelaren. Kallelsesvar räknas inte som närvaro.</p>
          </> : <p className="profile-empty">Inga pass med deltagande eller kallelse registrerade under perioden.</p>}
        </div>
        <details className="profile-details"><summary>Spelade matcher {year} ({matchHistory.length})</summary>
          {matchHistory.length ? <div className="profile-match-list">{matchHistory.map(match => <Link key={match.id} href={`/matcher/${match.id}`} className="profile-history-row">
            <span><strong>{match.opponent}</strong><small>{formatMatchDate(match.date)} · {matchTypeLabels[match.match_type] || "Match"} · {match.source_team || "Utan lagkoppling"}</small></span><span aria-hidden>›</span>
          </Link>)}</div> : <p className="profile-empty">Inga spelade matcher registrerade i år.</p>}
        </details>
        {earlierMatches.length > 0 && <details className="profile-details"><summary>Matcher från tidigare år ({earlierMatches.length})</summary>
          <div className="profile-match-list">{earlierMatches.map(match => <Link key={match.id} href={`/matcher/${match.id}`} className="profile-history-row"><span><strong>{match.opponent}</strong><small>{formatMatchDate(match.date)} · {matchTypeLabels[match.match_type] || "Match"} · {match.source_team || "Utan lagkoppling"}</small></span><span aria-hidden>›</span></Link>)}</div>
        </details>}
      </section>

      <details id="bedomning" className="core-panel core-form-panel" open={bedomning === "1"}>
        <summary className="core-section-head cursor-pointer list-none">
          <div><h2 className="core-section-title">Position och matchnivå</h2></div>
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

      {summary.goals.length > 0 && <details className="core-panel core-form-panel" open={Boolean(mal)}>
        <summary className="core-section-head cursor-pointer list-none">
          <div><p className="core-kicker">Historik</p><h2 className="core-section-title mt-2">Tidigare manuella mål</h2></div>
          <div className="flex items-center gap-3"><span className="core-section-note">{summary.goals.length} kvar</span><span aria-hidden="true" className="text-xl leading-none" style={{ color: "var(--ink-muted)" }}>⌄</span></div>
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

      </details>}

      {goalHistory.some((goal) => goal.status !== "active") && <details className="core-panel core-form-panel"><summary className="font-semibold cursor-pointer list-none flex items-center justify-between"><span>Tidigare mål</span><span aria-hidden="true" style={{ color: "var(--ink-muted)" }}>⌄</span></summary><div className="space-y-2 mt-4">{goalHistory.filter((goal) => goal.status !== "active").map((goal) => <p key={goal.id} className="body-small"><span className="badge mr-2">{goal.status === "achieved" ? "Uppnått" : "Pausat"}</span>{goal.title}</p>)}</div></details>}


    </div>
  );
}
