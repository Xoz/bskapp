import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canAccessGroup, getCurrentUser, isStaffRole } from "@/lib/auth";
import { getMatch } from "@/lib/queries";
import { matchEvaluationIsOpen } from "@/lib/matchEvaluation";
import { saveCoachMatchEvaluations } from "@/lib/actions";
import MatchEvaluationForm from "@/components/MatchEvaluationForm";
import { IconArrowLeft } from "@/components/Icons";
import { getOrganizationGroups } from "@/lib/organization";
import { getMobileMatchEvaluation } from "@/lib/services/matchEvaluationMobile";

export const dynamic = "force-dynamic";
export default async function EvaluateMatchPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ sparad?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.primaryRole)) redirect("/login");
  if (!user.permissions.includes("manage_evaluations")) redirect("/idag?behorighet=saknas");
  const matchId = Number((await params).id);
  if (!Number.isInteger(matchId)) notFound();
  const [match, groups] = await Promise.all([getMatch(matchId), getOrganizationGroups()]);
  if (!match || !(await canAccessGroup(match.group_id))) notFound();
  const group = groups.find((item) => item.id === match.group_id);
  if (group?.name !== "Gul" || !matchEvaluationIsOpen(match.date, match.start_time)) {
    redirect(`/matcher/${matchId}`);
  }
  const workspace = await getMobileMatchEvaluation(user, matchId);
  const save = saveCoachMatchEvaluations.bind(null, matchId);
  const { sparad } = await searchParams;
  return <div className="core-page max-w-3xl">
    <Link href={`/matcher/${matchId}`} className="inline-flex items-center gap-1.5 body-small" style={{ color: "var(--ink-secondary)" }}>
      <IconArrowLeft width={15} height={15} /> Till matchen</Link>
    <header className="core-header"><div className="core-header-copy"><p className="core-kicker">Matchutvärdering</p>
      <h1 className="core-title">{match.opponent}</h1><p className="core-lead">Bedöm en spelare i taget. Om en spelare inte går att bedöma kan du hoppa över henne.</p></div></header>
    {sparad === "matchinfo" && <div className="core-panel p-4"><p className="body-small">Resultat och tränarkommentar är sparade.</p></div>}
    <MatchEvaluationForm
      players={workspace.players}
      matchContext={{
        ourScore: workspace.match.ourScore,
        opponentScore: workspace.match.opponentScore,
        hasLiveData: workspace.match.hasLiveData,
        coachComment: workspace.match.coachComment,
      }}
      saveAction={save}
    />
  </div>;
}
