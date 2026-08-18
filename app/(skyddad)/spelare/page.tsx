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
    <div className="core-page">
      <header className="core-header">
        <div className="core-header-copy">
        <p className="core-kicker">Individuell utveckling</p>
        <h1 className="core-title">Spelare</h1>
        <p className="core-lead">
          Högst två aktiva mål per spelare. Observationer och exponering visar vad ni faktiskt har sett och erbjudit.
        </p>
        </div>
        <div className="core-panel px-4 py-3 text-right">
          <strong className="block text-xl">{players.length}</strong>
          <span className="core-section-note">aktiva spelare</span>
        </div>
      </header>
      <div className="core-list core-list-2">
        {players.map(({ player, goals, lastObservation, trainingCount, matchCount, selectedCount }) => (
          <Link key={player.id} href={`/spelare/${player.id}`} className="core-player-card">
            <div className="flex items-start gap-4">
              <Avatar name={player.name} jersey={player.jersey_number} size={42} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="core-player-name truncate">{player.name}</h2>
                  <span className={`core-tag ${goals.length ? "core-tag-training" : ""}`}>{goals.length}/2 mål</span>
                </div>
                <div>
                  {goals.length ? goals.map((goal) => (
                    <p key={goal.id} className="core-goal">{goal.title}</p>
                  )) : <p className="core-goal" style={{ borderColor: "var(--border)", color: "var(--ink-muted)" }}>Inget aktivt utvecklingsmål</p>}
                </div>
                <div className="core-statline">
                  <span>{trainingCount} träningar</span><span>{matchCount} matcher</span><span>{selectedCount} uttagningar</span>
                </div>
                {lastObservation && (
                  <p className="core-activity-sub mt-2">
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
