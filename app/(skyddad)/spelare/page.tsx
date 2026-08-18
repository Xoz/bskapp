import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { getPlayerCoreSummaries, type Evidence } from "@/lib/developmentCore";
import Avatar from "@/components/Avatar";

export const dynamic = "force-dynamic";

const EVIDENCE_LABELS: Record<Evidence, string> = { shown: "Visade", practicing: "Tränar på", revisit: "Nytt tillfälle" };

export default async function PlayersPage() {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.primaryRole)) redirect("/mina-spelare");
  if (!user.permissions.includes("view_players")) redirect("/idag?behorighet=saknas");
  const players = await getPlayerCoreSummaries();

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Individuell utveckling</p>
        <h1 className="mt-1">Spelare</h1>
        <p className="body mt-2 max-w-2xl" style={{ color: "var(--ink-secondary)" }}>
          Högst två aktiva mål per spelare. Observationer och exponering visar vad ni faktiskt har sett och erbjudit.
        </p>
      </header>
      <div className="grid md:grid-cols-2 gap-3">
        {players.map(({ player, goals, lastObservation, trainingCount, matchCount, selectedCount }) => (
          <Link key={player.id} href={`/spelare/${player.id}`} className="card p-5 block transition-transform hover:-translate-y-0.5">
            <div className="flex items-start gap-4">
              <Avatar name={player.name} jersey={player.jersey_number} size={46} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="truncate" style={{ fontSize: "22px" }}>{player.name}</h2>
                  <span className={`badge ${goals.length ? "badge-success" : "badge-warning"}`}>{goals.length}/2 mål</span>
                </div>
                <div className="mt-3 space-y-1.5">
                  {goals.length ? goals.map((goal) => (
                    <p key={goal.id} className="body-small"><span style={{ color: "var(--primary)" }}>Mål:</span> {goal.title}</p>
                  )) : <p className="body-small" style={{ color: "var(--ink-muted)" }}>Inget aktivt utvecklingsmål</p>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 caption" style={{ color: "var(--ink-secondary)" }}>
                  <span>{trainingCount} träningar</span><span>{matchCount} matcher</span><span>{selectedCount} uttagningar</span>
                </div>
                {lastObservation && (
                  <p className="caption mt-3" style={{ color: "var(--ink-muted)" }}>
                    Senast {lastObservation.activity_date}: {EVIDENCE_LABELS[lastObservation.evidence]} · {lastObservation.goal_title}
                  </p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
