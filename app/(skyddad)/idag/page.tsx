import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { getCoreHome, type CoreActivity } from "@/lib/developmentCore";
import { listMobilePlayerMatchLoads } from "@/lib/services/development";
import CoreActivityCard from "@/components/CoreActivityCard";

export const dynamic = "force-dynamic";
function matchHref(activity: CoreActivity) {
  return activity.match_id != null ? `/matcher/${activity.match_id}` : `/observera?aktivitet=${encodeURIComponent(activity.id)}`;
}
export default async function TodayPage() {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.primaryRole)) redirect("/mina-spelare");
  const canPlayers = user.permissions.includes("view_players");
  const [{ today, upcoming }, playerLoads] = await Promise.all([
    getCoreHome(),
    canPlayers ? listMobilePlayerMatchLoads(user) : Promise.resolve([]),
  ]);
  const yellowUpcoming = upcoming.filter((activity) => activity.source_team === "Gul");
  const highLoad = playerLoads.filter((player) => player.loadLevel === "high");
  const loadRank = { high: 0, maximum: 1, normal: 2 } as const;
  const sortedPlayerLoads = [...playerLoads].sort((a, b) => loadRank[a.loadLevel] - loadRank[b.loadLevel] || b.windowMatchCount - a.windowMatchCount || a.name.localeCompare(b.name, "sv"));
  const dateLabel = new Date(`${today}T12:00:00Z`).toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Stockholm" });
  return (
    <div className="core-page" style={{ maxWidth: "900px" }}>
      <header className="core-header"><div><p className="core-kicker">Lag Gul</p><h1 className="core-title">Idag</h1><p className="core-lead">{dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}</p></div></header>
      <section id="veckans-matcher">
        <div className="core-section-head"><h2 className="core-section-title">Den här veckan</h2><Link href="/matcher" className="btn-secondary btn-sm">Alla matcher</Link></div>
        <div className="core-list">
          {yellowUpcoming.map((activity) => <CoreActivityCard key={activity.id} activity={activity} href={matchHref(activity)} />)}
          {yellowUpcoming.length === 0 && <div className="core-panel p-6"><h2>Inga fler matcher den här veckan</h2><p className="core-lead">Kommande matcher och historik finns under Alla matcher.</p></div>}
        </div>
      </section>
      {canPlayers && <details id="belastning" className="core-panel">
        <summary className="p-5 cursor-pointer"><strong>Matchutrymme · Gulspelare</strong><span className="block text-sm mt-1" style={{ color: "var(--ink-secondary)" }}>Spelade och planerade matcher, sju dagar bakåt och framåt{highLoad.length > 0 ? ` · ${highLoad.length} över maxgränsen` : ""}</span></summary>
        <div className="bsk-link-list">{sortedPlayerLoads.length ? sortedPlayerLoads.map((player) => <Link key={player.playerId} href={`/spelare/${player.playerId}`} className="bsk-link-row"><span className="min-w-0 flex-1"><strong>{player.name}</strong><small>{player.recentMatches.length} spelade · {player.upcomingMatches.length} planerade</small></span><span className="text-right"><strong className="tabular-nums">{player.windowMatchCount} {player.windowMatchCount === 1 ? "match" : "matcher"}</strong><small style={{ color: player.loadLevel === "high" ? "var(--danger)" : player.loadLevel === "maximum" ? "var(--warning)" : "var(--ink-secondary)" }}>{player.loadLevel === "high" ? "För hög" : player.loadLevel === "maximum" ? "Vid maxgränsen" : "Normal"}</small></span></Link>) : <p className="p-5" style={{ color: "var(--ink-secondary)" }}>Ingen matchhistorik att visa ännu.</p>}</div>
      </details>}
    </div>
  );
}
