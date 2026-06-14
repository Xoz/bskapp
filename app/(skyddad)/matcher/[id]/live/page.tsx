import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRole, getCoachName } from "@/lib/auth";
import { getMatch } from "@/lib/queries";
import { getLiveState } from "@/lib/live";
import LiveTracker from "@/components/LiveTracker";
import { IconArrowLeft } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const role = await getRole();
  if (role !== "coach") redirect("/matcher");

  const { id } = await params;
  const match = await getMatch(Number(id));
  if (!match) notFound();

  const [initial, coachName] = await Promise.all([getLiveState(match.id), getCoachName()]);

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <Link
          href={`/matcher/${match.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-[var(--primary)]"
          style={{ color: "var(--ink-soft)", fontFamily: "var(--font-display)" }}
        >
          <IconArrowLeft width={15} height={15} /> Tillbaka till matchen
        </Link>
        <h1 className="text-[1.6rem] font-bold mt-2">Liverapportering</h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
          {match.home_away === "home" ? "Hemma mot" : "Borta mot"} {match.opponent} · {match.date}
          {match.start_time ? ` · ${match.start_time}` : ""}
        </p>
      </div>

      <LiveTracker code={String(match.id)} initial={initial} isCoach coachName={coachName ?? ""} />
    </div>
  );
}
