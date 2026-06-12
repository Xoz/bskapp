import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatchRowByCode, getLiveState } from "@/lib/live";
import LiveTracker from "@/components/LiveTracker";
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

  const initial = await getLiveState(match.id);

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
          {initial.date} · kod {clean}
        </span>
      </div>
      <LiveTracker code={clean} initial={initial} />
    </div>
  );
}
