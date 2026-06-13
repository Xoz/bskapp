import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatchRowByCode, getLiveState } from "@/lib/live";
import { getMatchesByCup } from "@/lib/queries";
import { getRole } from "@/lib/auth";
import LiveTracker from "@/components/LiveTracker";
import CupReportSwitcher from "@/components/CupReportSwitcher";
import { IconArrowLeft } from "@/components/Icons";

export const dynamic = "force-dynamic";

function minutesUntilOpen(date: string, startTime: string): number {
  // Returnerar antal minuter tills rapporteringen öppnar (negativt = redan öppen)
  const [h, m] = startTime.split(":").map(Number);
  const matchStart = new Date(`${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
  const opensAt = new Date(matchStart.getTime() - 15 * 60 * 1000);
  return Math.ceil((opensAt.getTime() - Date.now()) / 60000);
}

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
  // Ingår matchen i en cup? Visa då alla cupens matcher att hoppa mellan.
  const cupMatches = match.cup_name ? await getMatchesByCup(match.cup_name) : [];

  // 15-minuterspärr – gäller bara om avsparktid är angiven
  if (initial.startTime) {
    const minsLeft = minutesUntilOpen(initial.date, initial.startTime);
    if (minsLeft > 0) {
      return (
        <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
          <div className="max-w-md mx-auto px-4 pt-3 pb-1 flex items-center justify-between w-full">
            <Link
              href="/rapportera"
              className="inline-flex items-center gap-1.5 text-xs font-semibold transition-colors hover:text-[var(--primary)]"
              style={{ color: "var(--ink-faint)", fontFamily: "var(--font-display)" }}
            >
              <IconArrowLeft width={13} height={13} /> Annan matchkod
            </Link>
            <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
              {initial.date} · {initial.startTime}
            </span>
          </div>
          {match.cup_name && (
            <CupReportSwitcher cupName={match.cup_name} matches={cupMatches} currentCode={clean} />
          )}
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="card p-8 max-w-sm w-full text-center">
              <p className="text-4xl mb-4">⏳</p>
              <h2 className="font-semibold text-xl mb-2" style={{ fontFamily: "var(--font-display)" }}>
                Inte öppet än
              </h2>
              <p className="text-sm mb-4" style={{ color: "var(--ink-soft)" }}>
                Rapporteringen öppnar <strong>15 minuter innan avspark</strong>.
              </p>
              <p className="text-sm" style={{ color: "var(--ink-faint)" }}>
                {initial.opponent} · {initial.date} kl {initial.startTime}
              </p>
              <p className="mt-4 text-xs rounded-full px-4 py-2 inline-block" style={{ background: "var(--bg2)", color: "var(--ink-soft)" }}>
                Öppnar om ca {minsLeft} {minsLeft === 1 ? "minut" : "minuter"}
              </p>
            </div>
          </div>
        </div>
      );
    }
  }

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
