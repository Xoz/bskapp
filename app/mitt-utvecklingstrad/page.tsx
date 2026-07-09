import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlayerSession } from "@/lib/auth";
import { getPlayer, getPlayerSkillStatuses } from "@/lib/queries";
import UtvecklingChecklist from "@/components/UtvecklingChecklist";
import { IconArrowLeft } from "@/components/Icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mitt utvecklingsträd" };

export default async function MittUtvecklingstradPage() {
  const playerId = await getPlayerSession();
  if (!playerId) redirect("/spelare/login");

  const player = await getPlayer(playerId);
  if (!player || !player.active) redirect("/spelare/login");

  const statuses = await getPlayerSkillStatuses(playerId);
  const firstName = player.name.split(" ")[0];

  return (
    <div className="space-y-6 max-w-3xl mx-auto px-5 py-8">
      <Link
        href="/min-profil"
        className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-[var(--primary)]"
        style={{ color: "var(--ink-soft)", fontFamily: "var(--font-display)" }}
      >
        <IconArrowLeft width={15} height={15} /> Min profil
      </Link>

      <div>
        <p className="eyebrow">Utvecklingsträd · 7v7 → 9v9</p>
        <h1 className="text-[1.5rem] font-bold leading-tight mt-0.5">Hej, {firstName}!</h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
          Det här är vad din tränare ser att du redan klarar, vad du tränar på nu och vad nästa steg är.
        </p>
      </div>

      <UtvecklingChecklist playerId={player.id} firstName={firstName} initialStatuses={statuses} readOnly />
    </div>
  );
}
