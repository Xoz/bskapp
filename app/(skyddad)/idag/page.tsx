import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { getCoreHome, getPlayerCoreSummaries, type CoreActivity } from "@/lib/developmentCore";
import { getPendingMatchEvaluations } from "@/lib/matchEvaluation";
import { listMobilePlayerMatchLoads } from "@/lib/services/development";
import CoreActivityCard from "@/components/CoreActivityCard";
import Avatar from "@/components/Avatar";
import { IconArrowRight, IconPlayers, IconPitch, IconChart } from "@/components/Icons";

export const dynamic = "force-dynamic";
function matchHref(activity: CoreActivity) {
  return activity.match_id != null ? `/matcher/${activity.match_id}` : `/observera?aktivitet=${encodeURIComponent(activity.id)}`;
}
export default async function TodayPage() {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.primaryRole)) redirect("/mina-spelare");
  const canPlayers = user.permissions.includes("view_players");
  const canEvaluate = user.permissions.includes("manage_evaluations");
  const canSquads = user.permissions.includes("manage_squads");
  const [{ today, upcoming }, pendingEvaluations, playerLoads, players] = await Promise.all([
    getCoreHome(),
    canEvaluate ? getPendingMatchEvaluations() : Promise.resolve([]),
    canPlayers ? listMobilePlayerMatchLoads(user) : Promise.resolve([]),
    canPlayers ? getPlayerCoreSummaries() : Promise.resolve([]),
  ]);
  const nextMatch = upcoming.find((activity) => activity.is_upcoming);
  const staffing = upcoming.map((activity) => {
    const called = Number(activity.accepted_callup_count) + Number(activity.declined_callup_count) + Number(activity.pending_callup_count);
    const ready = activity.has_confirmed_squad ? Number(activity.squad_count) : Number(activity.accepted_callup_count);
    return { activity, called, ready, missing: Math.max(0, 9 - ready) };
  });
  const yellowStaffing = staffing.filter((row) => row.activity.source_team === "Gul");
  const understaffed = yellowStaffing.filter((row) => (row.activity.has_confirmed_squad || row.called > 0) && row.missing > 0);
  const unanswered = yellowStaffing.reduce((sum, row) => sum + Number(row.activity.pending_callup_count), 0);
  const maximumLoad = playerLoads.filter((player) => player.loadLevel === "maximum");
  const highLoad = playerLoads.filter((player) => player.loadLevel === "high");
  const loadRank = { high: 0, maximum: 1, normal: 2 } as const;
  const sortedPlayerLoads = [...playerLoads].sort((a, b) => loadRank[a.loadLevel] - loadRank[b.loadLevel] || b.windowMatchCount - a.windowMatchCount || a.name.localeCompare(b.name, "sv"));
  const dateLabel = new Date(`${today}T12:00:00Z`).toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Stockholm" });
  const previewPlayers = players.filter(({ teams }) => teams.some((team) => team.name === "Gul")).slice(0, 3);
  const visiblePlayers = previewPlayers.length ? previewPlayers : players.slice(0, 3);

  return (
    <div className="core-page">
      <header className="core-header"><div><h1 className="core-title">Idag</h1><p className="core-lead">{dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}</p></div></header>
      <div className="bsk-today-grid">
        <div className="bsk-today-main">
          {nextMatch ? <section className="core-panel bsk-next-match" aria-label="Nästa match">
            <p className="core-kicker">Nästa match{nextMatch.source_team ? ` · ${nextMatch.source_team}` : ""}</p>
            <h2>{nextMatch.title}</h2>
            <p className="bsk-match-meta">{new Date(`${nextMatch.activity_date}T12:00:00Z`).toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "short", timeZone: "Europe/Stockholm" })}{nextMatch.start_time ? ` · ${nextMatch.start_time}` : ""}</p>
            <div>{nextMatch.has_confirmed_squad ? <span className="badge" style={{ background: "var(--ok-bg)", color: "var(--ok)" }}>{nextMatch.squad_count} uttagna</span> : <span className="badge" style={{ background: "var(--elevated)", color: "var(--ink-secondary)" }}>{Number(nextMatch.accepted_callup_count)} har tackat ja</span>}</div>
            <Link href={matchHref(nextMatch)} className="btn-primary">Öppna match <IconArrowRight width={20} height={20} /></Link>
          </section> : <section className="core-panel p-6"><h2>Inga fler matcher den här veckan</h2><p className="core-lead">Kommande matcher och tidigare resultat finns i matchöversikten.</p><Link href="/matcher" className="btn-secondary mt-4">Visa matcher</Link></section>}

          {canPlayers && <section><div className="core-section-head"><h2 className="core-section-title">Spelarutveckling</h2><Link href="/spelare" className="btn-secondary btn-sm">Visa alla</Link></div>
            <div className="core-panel bsk-link-list">{visiblePlayers.length ? visiblePlayers.map(({ player, goals }) => <Link key={player.id} href={`/spelare/${player.id}`} className="bsk-link-row"><Avatar name={player.name} jersey={player.jersey_number} size={40} /><span className="min-w-0 flex-1"><strong>{player.name}</strong><small>{goals[0] ? `Mål: ${goals[0].title}` : "Öppna spelarens utvecklingsbild"}</small></span><IconArrowRight width={18} height={18} /></Link>) : <p className="p-5" style={{ color: "var(--ink-secondary)" }}>Inga spelare att visa ännu.</p>}</div>
            <div className="core-panel bsk-link-list mt-3"><Link href="/spelare" className="bsk-link-row"><IconPlayers width={22} height={22} /><span className="min-w-0 flex-1"><strong>Spelarsamtal</strong><small>Välj spelare och förbered samtal</small></span><IconArrowRight width={18} height={18} /></Link></div>
          </section>}
          {canEvaluate && <Link href="/observera" className="btn-secondary"><IconChart width={20} height={20} />Observera och utvärdera</Link>}

          {((canSquads && understaffed.length > 0) || pendingEvaluations.length > 0) && <section id="att-gora">
            <div className="core-section-head"><h2 className="core-section-title">Att följa upp</h2></div>
            <div className="core-list">
              {canSquads && understaffed.map(({ activity, ready, missing }) => <Link key={activity.id} href={matchHref(activity)} className="core-action-card"><span className="core-action-index">Trupp</span><span><strong>{activity.title}</strong><small>{ready} klara · saknar {missing} till 9</small></span><span className="core-chevron" aria-hidden>›</span></Link>)}
              {pendingEvaluations.map((evaluation) => <Link key={evaluation.id} href={`/matcher/${evaluation.id}/utvardera`} className="core-action-card"><span className="core-action-index">Efter</span><span><strong>Utvärdera matchen mot {evaluation.opponent}</strong><small>{evaluation.evaluated} av {evaluation.total} spelare klara</small></span><span className="core-chevron" aria-hidden>›</span></Link>)}
            </div>
          </section>}
        </div>
        <aside className="bsk-today-aside">
          <section id="veckans-matcher"><div className="core-section-head"><h2 className="core-section-title">Den här veckan</h2></div><div className="core-list">{upcoming.map((activity) => <CoreActivityCard key={activity.id} activity={activity} href={matchHref(activity)} />)}</div>
            <Link href="/matcher" className="btn-secondary w-full mt-3"><IconPitch width={20} height={20} />Alla matcher och cuper</Link>
          </section>
          <details className="core-panel"><summary className="p-5 cursor-pointer font-semibold">Veckan i siffror</summary><div className="bsk-week-summary">
            <Link href="#veckans-matcher"><span className="block caption">Matcher</span><strong className="block mt-1">{upcoming.length}</strong><small>kvar den här veckan</small></Link>
            <Link href={canSquads && understaffed.length ? "#att-gora" : "#veckans-matcher"}><span className="block caption">Trupp att se över</span><strong className="block mt-1">{understaffed.length}</strong><small>färre än 9 klara</small></Link>
            <Link href={canSquads && understaffed.length ? "#att-gora" : "#veckans-matcher"}><span className="block caption">Inväntar svar</span><strong className="block mt-1">{unanswered}</strong><small>spelarsvar för Gul</small></Link>
            {canPlayers && <><Link href="#belastning"><span className="block caption">Vid maxgränsen</span><strong className="block mt-1">{maximumLoad.length}</strong><small>3 kommande eller 5 totalt</small></Link>
            <Link href="#belastning"><span className="block caption">För hög belastning</span><strong className="block mt-1">{highLoad.length}</strong><small>över maxgränsen</small></Link></>}
          </div></details>
        </aside>
      </div>
      {canPlayers && <details id="belastning" className="core-panel">
        <summary className="p-5 cursor-pointer"><strong>Matchutrymme · Gulspelare</strong><span className="block text-sm mt-1" style={{ color: "var(--ink-secondary)" }}>Spelade och planerade matcher, sju dagar bakåt och framåt{highLoad.length > 0 ? ` · ${highLoad.length} över maxgränsen` : ""}</span></summary>
        <div className="bsk-link-list">{sortedPlayerLoads.length ? sortedPlayerLoads.map((player) => <Link key={player.playerId} href={`/spelare/${player.playerId}`} className="bsk-link-row"><span className="min-w-0 flex-1"><strong>{player.name}</strong><small>{player.recentMatches.length} spelade · {player.upcomingMatches.length} planerade</small></span><span className="text-right"><strong className="tabular-nums">{player.windowMatchCount} {player.windowMatchCount === 1 ? "match" : "matcher"}</strong><small style={{ color: player.loadLevel === "high" ? "var(--danger)" : player.loadLevel === "maximum" ? "var(--warning)" : "var(--ink-secondary)" }}>{player.loadLevel === "high" ? "För hög" : player.loadLevel === "maximum" ? "Vid maxgränsen" : "Normal"}</small></span></Link>) : <p className="p-5" style={{ color: "var(--ink-secondary)" }}>Ingen matchhistorik att visa ännu.</p>}</div>
      </details>}
    </div>
  );
}
