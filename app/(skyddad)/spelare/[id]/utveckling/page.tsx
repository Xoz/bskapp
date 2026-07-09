import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getPlayer, getPlayerSkillStatuses, getPlayerSkillNote } from "@/lib/queries";
import Avatar from "@/components/Avatar";
import UtvecklingChecklist from "@/components/UtvecklingChecklist";
import { IconArrowLeft } from "@/components/Icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Utvecklingsträd" };

export default async function PlayerSkillTreePage({ params }: { params: Promise<{ id: string }> }) {
  const role = await getRole();
  if (role !== "coach") redirect("/matcher");

  const { id } = await params;
  const player = await getPlayer(Number(id));
  if (!player || !player.active) notFound();

  const [statuses, note] = await Promise.all([
    getPlayerSkillStatuses(player.id),
    getPlayerSkillNote(player.id),
  ]);
  const firstName = player.name.replace(/^Exempel:\s*/, "").split(" ")[0];

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href={`/spelare/${player.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-[var(--primary)]"
        style={{ color: "var(--ink-soft)", fontFamily: "var(--font-display)" }}
      >
        <IconArrowLeft width={15} height={15} /> {player.name}
      </Link>

      <div className="card p-6 md:p-7 flex items-center gap-5">
        <Avatar name={player.name} jersey={player.jersey_number} size={56} />
        <div>
          <p className="eyebrow">Utvecklingsträd · 7v7 → 9v9</p>
          <h1 className="text-[1.5rem] font-bold leading-tight mt-0.5">{player.name}</h1>
          <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
            Vad {firstName} redan behärskar, vad hen tränar på nu och vad nästa steg är.
          </p>
        </div>
      </div>

      <UtvecklingChecklist
        playerId={player.id}
        firstName={firstName}
        initialStatuses={statuses}
        initialNote={note}
      />
    </div>
  );
}
