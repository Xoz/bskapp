import { redirect } from "next/navigation";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { getSelectionWorkspace } from "@/lib/developmentCore";
import MatchSelection from "@/components/MatchSelection";

export const dynamic = "force-dynamic";
export default async function SelectionPage({ searchParams }: {
  searchParams: Promise<{ aktivitet?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.primaryRole)) redirect("/mina-spelare");
  if (!user.permissions.includes("manage_squads")) redirect("/idag?behorighet=saknas");
  const { aktivitet } = await searchParams;
  if (!aktivitet) redirect("/matcher");
  const workspace = await getSelectionWorkspace(aktivitet);
  if (!workspace || workspace.activity.source_team !== "Gul") redirect("/matcher");
  if (workspace.activity.match_id != null) redirect(`/matcher/${workspace.activity.match_id}/laguttagning`);
  return <MatchSelection workspace={workspace} />;
}
