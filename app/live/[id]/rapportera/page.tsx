import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatch } from "@/lib/queries";
import { getLiveState } from "@/lib/live";
import { reportingAutoOpen } from "@/lib/dates";
import { getAllSettings } from "@/lib/db";
import LiveTracker from "@/components/LiveTracker";
import LiveClock from "@/components/LiveClock";
import { IconArrowLeft } from "@/components/Icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rapportera" };

export default async function PublicReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const matchId = Number(id);
  if (!Number.isInteger(matchId) || matchId <= 0) notFound();

  const match = await getMatch(matchId);
  if (!match) notFound();

  // Rapportering måste vara öppen (manuellt eller automatiskt 60 min före avspark)
  // och matchen får inte vara avslutad.
  const reportOpen = !!match.report_open || reportingAutoOpen(match.date, match.start_time);
  if (!reportOpen || match.finished) {
    const settings = await getAllSettings();
    return (
      <main className="flex-1 p-6 max-w-md w-full mx-auto" style={{ paddingTop: "max(2rem, env(safe-area-inset-top))" }}>
        <div className="flex justify-end mb-4">
          <LiveClock />
        </div>
        <div className="card p-8 text-center">
          <p className="text-3xl mb-3">🔒</p>
          <p className="font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>
            Rapportering är inte öppen
          </p>
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            {match.finished
              ? "Matchen är avslutad."
              : `Rapporteringen öppnar automatiskt 60 minuter före avspark (eller när tränaren öppnar den). Du kan redan nu följa ${settings.team_name} live.`}
          </p>
          <Link href={`/live/${matchId}`} className="btn-secondary mt-5 inline-flex">
            Till Livescore
          </Link>
        </div>
      </main>
    );
  }

  const initial = await getLiveState(matchId, true);

  return (
    <main className="flex-1 p-4 sm:p-6 max-w-lg w-full mx-auto" style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}>
      <div className="flex justify-end mb-3">
        <LiveClock />
      </div>
      <div className="mb-4">
        <Link
          href={`/live/${matchId}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-[var(--primary)]"
          style={{ color: "var(--ink-soft)", fontFamily: "var(--font-display)" }}
        >
          <IconArrowLeft width={15} height={15} /> Livescore
        </Link>
        <h1 className="text-[1.5rem] font-bold mt-2">Rapportera</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--ink-soft)" }}>
          {match.home_away === "home" ? "Hemma mot" : "Borta mot"} {match.opponent} · {match.date}
        </p>
      </div>

      <LiveTracker code={String(matchId)} initial={initial} isCoach={false} />
    </main>
  );
}
