import MatchSpaceBar from "@/components/MatchSpaceBar";
import { getMatchSpaceInputs } from "@/lib/matchSpaceData";
import { forecastMatchSpace } from "@/lib/matchSpace";
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
        <details className="px-5 pb-3 text-sm"><summary className="cursor-pointer">Så räknas batteriet</summary><p className="mt-2" style={{color: "var(--ink-secondary)"}}>Uppskattad planering utifrån registrerat deltagande och kallelser i alla lag. Speltiden delas jämnt mellan utespelarna; träning uppskattas till 60 minuter. Cuper räknas separat. Annan idrott och saknad närvaro ingår inte. Öppna en matchs trupputtagning för att prova en extra match eller ett lån. 100 % motsvarar alltid spelarens justerade maxkapacitet.</p></details>
        {inputs.values().next().value?.sourceWarning && <p className="px-5 pb-3 text-sm" style={{color:"var(--warning)"}}>{inputs.values().next().value?.sourceWarning}</p>}
        <p className="px-4 pb-2 space-battery-legend"><i aria-hidden="true"/>Lägst <i aria-hidden="true"/>Till nuvarande nivå · prognos 7 dagar</p>
        <div className="bsk-link-list">{sortedPlayerLoads.length ? sortedPlayerLoads.map(player => <Link key={player.playerId} href={`/spelare/${player.playerId}`} className="bsk-link-row space-battery-row">
          <MatchSpaceBar label={player.name} forecast={player.space}/>
        </Link>) : <p className="p-5" style={{ color: "var(--ink-secondary)" }}>Inga spelare att visa.</p>}</div>
      </details>}
    </div>
  );
}
