import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getRole, hasPermission } from "@/lib/auth";
import { getPlayers } from "@/lib/queries";
import { getOrganizationGroups } from "@/lib/organization";
import MatchForm from "@/components/MatchForm";
import { IconArrowLeft } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function NewMatchPage() {
  const role = await getRole();
  if (role !== "coach") redirect("/matcher");
  if (!(await hasPermission("manage_matches"))) redirect("/matcher?behorighet=saknas");

  const [players, allGroups, user] = await Promise.all([getPlayers(), getOrganizationGroups(), getCurrentUser()]);
  const groups = allGroups.filter((group) => group.active && group.group_type !== "squad" && (!user || user.roles.includes("admin") || user.groupIds.length === 0 || user.groupIds.includes(group.id) || (group.parent_id != null && user.groupIds.includes(group.parent_id))));

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          href="/matcher"
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-[var(--primary)]"
          style={{ color: "var(--ink-soft)", fontFamily: "var(--font-display)" }}
        >
          <IconArrowLeft width={15} height={15} /> Matcher
        </Link>
        <h1 className="text-[1.7rem] font-bold mt-2">Lägg till match manuellt</h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
          Tips: koppla lagets kalender från svenskalag.se under Inställningar så hämtas matcherna
          automatiskt.
        </p>
      </div>
      <MatchForm players={players} groups={groups} />
    </div>
  );
}
