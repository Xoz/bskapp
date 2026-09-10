import { getMatchSpaceInputs } from "@/lib/matchSpaceData";
import { forecastMatchSpace, spaceLabels } from "@/lib/matchSpace";
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
  const inputs = canPlayers ? await getMatchSpaceInputs(playerLoads.map(player => player.playerId)) : new Map();
  const sortedPlayerLoads = playerLoads.map(player => ({ ...player, space: forecastMatchSpace(inputs.get(player.playerId)!) }))
    .sort((a, b) => (b.space.lowest / b.space.capacity) - (a.space.lowest / a.space.capacity) || a.name.localeCompare(b.name, "sv"));
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
        <summary className="p-5 cursor-pointer"><strong>Matchutrymme · Gulspelare</strong><span className="block text-sm mt-1" style={{ color: "var(--ink-secondary)" }}>Batteri nu och prognos med planerade aktiviteter kommande sju dagar</span></summary>
        <p className="px-5 pb-4 text-sm" style={{color: "var(--ink-secondary)"}}>Uppskattad planering utifrån registrerat deltagande och kallelser i alla lag. Saknad speltid räknas som hela matchen; träning som 60 minuter. Annan idrott och saknad närvaro ingår inte. Öppna en matchs trupputtagning för att prova en extra match eller ett lån.</p>
        {inputs.values().next().value?.sourceWarning && <p className="px-5 pb-3 text-sm" style={{color:"var(--warning)"}}>{inputs.values().next().value?.sourceWarning}</p>}
        <div className="bsk-link-list">{sortedPlayerLoads.length ? sortedPlayerLoads.map((player) => <Link key={player.playerId} href={`/spelare/${player.playerId}`} className="bsk-link-row"><span className="min-w-0 flex-1"><strong>{player.name}</strong><small>Lägst {player.space.lowest}/{player.space.capacity} med planerade aktiviteter</small><progress style={{accentColor: "var(--primary)", height: "0.5rem"}} className="w-full" aria-label={`Matchutrymme nu för ${player.name}`} value={player.space.current} max={player.space.capacity} /></span><span className="text-right"><strong className="tabular-nums">{player.space.current}/{player.space.capacity} nu</strong><small style={{ color: player.space.level === "high" ? "var(--danger)" : player.space.level === "maximum" ? "var(--warning)" : "var(--ink-secondary)" }}>{spaceLabels[player.space.level]}</small><small>Uppskattning</small></span></Link>) : <p className="p-5" style={{ color: "var(--ink-secondary)" }}>Inga spelare att visa.</p>}</div>
      </details>}
    </div>
  );
}
