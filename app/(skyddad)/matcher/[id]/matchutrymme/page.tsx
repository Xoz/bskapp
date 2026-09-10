import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getMatch } from "@/lib/queries";
import { all } from "@/lib/db";
import { getPlayerCoreSummaries } from "@/lib/developmentCore";
import { getMatchSpaceInputs } from "@/lib/matchSpaceData";
import { swedishToday } from "@/lib/dates";
import MatchSpacePlanner from "@/components/MatchSpacePlanner";
export const dynamic = "force-dynamic";

export default async function MatchSpacePage({params}:{params:Promise<{id:string}>}) {
  const user = await getCurrentUser();
  if (!user?.permissions.includes("manage_squads") || !user.permissions.includes("view_players")) redirect("/matcher");
  const {id} = await params;
  const match = await getMatch(Number(id));
  if (!match) notFound();
  if (match.cancelled || match.finished || match.date < swedishToday()) return <div className="core-page"><p>Matchen är inte kommande. Prognosen används inför en kallelse eller utlåning.</p><Link href={`/matcher/${match.id}`}>Tillbaka till matchen</Link></div>;
  const summaries = await getPlayerCoreSummaries();
  const candidates = summaries.filter(p => p.player.active);
  const [inputs, roster] = await Promise.all([
    getMatchSpaceInputs(candidates.map(p => p.player.id),match.id),
    all<{player_id:number; callup_status:string|null}>("SELECT player_id, callup_status FROM match_roster WHERE match_id=?",[match.id]),
  ]);
  const statuses = new Map(roster.map(r => [r.player_id,r.callup_status]));
  return <div className="core-page" style={{maxWidth:"850px"}}>
    <Link href={`/matcher/${match.id}`} className="text-sm underline">← Tillbaka till matchen</Link>
    <header><h1 className="core-title">Matchutrymme</h1><p className="core-lead">Mot {match.opponent} · {match.date}{match.start_time ? ` kl. ${match.start_time}` : " · Tid saknas"}</p><p className="mt-2">Jämför utrymme för kallelse eller lån och prova hur speltiden påverkar kommande matcher.</p></header>
    <MatchSpacePlanner players={candidates.map(p => ({id:p.player.id,name:p.player.name,team:p.primaryTeam?.name ?? "Utan lag",input:inputs.get(p.player.id)!,status:statuses.get(p.player.id) ?? null}))}/>
  </div>;
}
