import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canAccessGroup, getCoachName, getCurrentUser, isStaffRole } from "@/lib/auth";
import { getMatch } from "@/lib/queries";
import { getLiveState } from "@/lib/live";
import LiveTracker from "@/components/LiveTracker";
import { IconArrowLeft } from "@/components/Icons";
import { getOrganizationGroups } from "@/lib/organization";

export const dynamic = "force-dynamic";

export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.primaryRole)) redirect("/matcher");
  if (!user.permissions.includes("report_matches")) redirect("/idag?behorighet=saknas");

  const { id } = await params;
  const [match, groups] = await Promise.all([getMatch(Number(id)), getOrganizationGroups()]);
  if (!match || !(await canAccessGroup(match.group_id))) notFound();
  if (groups.find((group) => group.id === match.group_id)?.name !== "Gul") redirect(`/matcher/${match.id}`);

  const [initial, coachName] = await Promise.all([getLiveState(match.id, true), getCoachName()]);

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <Link
          href={`/matcher/${match.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-[var(--primary)]"
          style={{ color: "var(--ink-secondary)", fontFamily: "var(--font-display)" }}
        >
          <IconArrowLeft width={15} height={15} /> Tillbaka till matchen
        </Link>
        <h1 className="text-[28px] font-bold mt-2">Liverapportering</h1>
        <p className="body-small mt-1" style={{ color: "var(--ink-secondary)" }}>
          {match.home_away === "home" ? "Hemma mot" : "Borta mot"} {match.opponent} · {match.date}
          {match.start_time ? ` · ${match.start_time}` : ""}
        </p>
      </div>

      <LiveTracker code={String(match.id)} initial={initial} isCoach coachName={coachName ?? ""} />
    </div>
  );
}
