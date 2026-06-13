import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatchRowByCode, getLiveState } from "@/lib/live";
import { getMatchesByCup } from "@/lib/queries";
import { getRole } from "@/lib/auth";
import LiveTracker from "@/components/LiveTracker";
import CupReportSwitcher from "@/components/CupReportSwitcher";
import { IconArrowLeft } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function ReportMatchPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const clean = code.replace(/\D/g, "");
  const match = await getMatchRowByCode(clean);
  if (!match) notFound();

  const [initial, role] = await Promise.all([getLiveState(match.id), getRole()]);
  const isCoach = role === "coach";
  const cupMatches = match.cup_name ? await getMatchesByCup(match.cup_name) : [];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="max-w-md mx-auto px-4 pt-3 pb-1 flex items-center justify-between">
        <Link
          href="/rapportera"
          className="inline-flex items-center gap-1.5 text-xs font-semibold transition-colors hover:text-[var(--primary)]"
          style={{ color: "var(--ink-faint)", fontFamily: "var(--font-display)" }}
        >
          <IconArrowLeft width={13} height={13} /> Annan matchkod
        </Link>
        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
          {initial.date}{initial.startTime ? ` · ${initial.startTime}` : ""} · kod {clean}
        </span>
      </div>
      {match.cup_name && (
        <CupReportSwitcher cupName={match.cup_name} matches={cupMatches} currentCode={clean} />
      )}
      <LiveTracker code={clean} initial={initial} isCoach={isCoach} />
    </div>
  );
}
