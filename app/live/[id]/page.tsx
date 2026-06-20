import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatch } from "@/lib/queries";
import { getLiveState } from "@/lib/live";
import { getAllSettings } from "@/lib/db";
import LiveScoreboard from "@/components/LiveScoreboard";
import LiveClock from "@/components/LiveClock";
import { IconArrowLeft } from "@/components/Icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Livescore" };

export default async function PublicLivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const matchId = Number(id);
  if (!Number.isInteger(matchId) || matchId <= 0) notFound();

  const match = await getMatch(matchId);
  if (!match) notFound();

  const [initial, settings] = await Promise.all([getLiveState(matchId), getAllSettings()]);

  return (
    <main className="flex-1 p-4 sm:p-6 max-w-lg w-full mx-auto" style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}>
      <div className="flex justify-end mb-3">
        <LiveClock />
      </div>
      <div className="mb-5">
        <Link
          href="/live"
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-[var(--primary)]"
          style={{ color: "var(--ink-soft)", fontFamily: "var(--font-display)" }}
        >
          <IconArrowLeft width={15} height={15} /> Livescore
        </Link>
        <h1 className="text-[1.5rem] font-bold mt-2">
          {match.home_away === "home" ? "Hemma mot" : "Borta mot"} {match.opponent}
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--ink-soft)" }}>
          {settings.team_name} · {match.date}
          {match.start_time ? ` · ${match.start_time}` : ""}
        </p>
      </div>

      <LiveScoreboard
        matchId={matchId}
        initial={initial}
        homeAway={match.home_away}
        opponent={match.opponent}
      />
    </main>
  );
}
