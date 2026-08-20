import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canAccessGroup, getCurrentUser, isStaffRole } from "@/lib/auth";
import { getMatch } from "@/lib/queries";
import { getMatchEvaluationWorkspace } from "@/lib/matchEvaluation";
import { saveCoachMatchEvaluations } from "@/lib/actions";
import MatchEvaluationForm from "@/components/MatchEvaluationForm";
import { IconArrowLeft } from "@/components/Icons";

export const dynamic = "force-dynamic";
export default async function EvaluateMatchPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ sparad?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.primaryRole)) redirect("/login");
  const matchId = Number((await params).id);
  if (!Number.isInteger(matchId)) notFound();
  const match = await getMatch(matchId);
  if (!match || !(await canAccessGroup(match.group_id))) notFound();
  const workspace = await getMatchEvaluationWorkspace(matchId, "coach", String(user.id));
  if (!workspace) notFound();
  const save = saveCoachMatchEvaluations.bind(null, matchId);
  const { sparad } = await searchParams;
  return <div className="core-page max-w-3xl">
    <Link href={workspace.match.activity_id ? `/observera?aktivitet=${encodeURIComponent(workspace.match.activity_id)}` : `/matcher/${matchId}`} className="inline-flex items-center gap-1.5 body-small" style={{ color: "var(--ink-secondary)" }}>
      <IconArrowLeft width={15} height={15} /> Till matchen</Link>
    <header className="core-header"><div className="core-header-copy"><p className="core-kicker">Matchutvärdering</p>
      <h1 className="core-title">{match.opponent}</h1><p className="core-lead">Två val per spelare. Underlaget kommer från den sparade uttagningen; om den saknas används spelarna som tackat ja.</p></div></header>
    {sparad && <div className="core-panel p-4"><p className="body-small">Utvärderingen är sparad. Du kan ändra svaren när som helst.</p></div>}
    {workspace.players.length ? <MatchEvaluationForm players={workspace.players} saveAction={save} /> :
      <div className="core-panel p-6"><p>Det finns ingen registrerad matchtrupp att utvärdera.</p></div>}
  </div>;
}
