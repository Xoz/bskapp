import Link from "next/link";
import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getPlayers } from "@/lib/queries";
import MatchForm from "@/components/MatchForm";
import { IconArrowLeft } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function NewMatchPage() {
  const role = await getRole();
  if (role !== "coach") redirect("/matcher");

  const players = getPlayers();

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
      <MatchForm players={players} />
    </div>
  );
}
