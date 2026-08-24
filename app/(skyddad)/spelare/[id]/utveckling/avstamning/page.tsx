import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getLatestDevelopmentCheckpoint, getPlayer, getPlayerSkillStatuses } from "@/lib/queries";
import { swedishToday } from "@/lib/dates";
import DevelopmentCheckinForm from "@/components/DevelopmentCheckinForm";
import Avatar from "@/components/Avatar";
import { IconArrowLeft } from "@/components/Icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Uppdatera utvecklingsbild" };

export default async function DevelopmentCheckinPage({ params }: { params: Promise<{ id: string }> }) {
  const role = await getRole();
  if (role !== "coach") redirect("/matcher");

  const { id } = await params;
  const player = await getPlayer(Number(id));
  if (!player || !player.active) notFound();

  const [statuses, latest] = await Promise.all([
    getPlayerSkillStatuses(player.id),
    getLatestDevelopmentCheckpoint(player.id),
  ]);
  const firstName = player.name.replace(/^Exempel:\s*/, "").split(" ")[0];
  const focusIds = latest?.skills.filter((skill) => skill.is_focus).map((skill) => skill.skill_id) ?? [];

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href={`/spelare/${player.id}/utveckling`}
        className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-[var(--primary)]"
        style={{ color: "var(--ink-secondary)", fontFamily: "var(--font-display)" }}
      >
        <IconArrowLeft width={15} height={15} /> {firstName}s utveckling
      </Link>

      <header className="core-panel p-5 md:p-6 flex items-center gap-5">
        <Avatar name={player.name} jersey={player.jersey_number} size={56} />
        <div>
          <p className="core-kicker">Utvecklingsträd</p>
          <h1 className="core-section-title mt-2">Uppdatera {firstName}s utvecklingsbild</h1>
          <p className="body-small mt-1" style={{ color: "var(--ink-secondary)" }}>
            Uppdatera det som har förändrats, välj högst två fokus och spara nuläget i historiken.
          </p>
        </div>
      </header>

      <DevelopmentCheckinForm
        playerId={player.id}
        firstName={firstName}
        today={swedishToday()}
        initialStatuses={statuses}
        initialFocusIds={focusIds}
        initialStrengths={latest?.strengths ?? ""}
        initialFocusNote={latest?.focus_note ?? ""}
        initialWellbeingNote={latest?.wellbeing_note ?? ""}
      />
    </div>
  );
}
