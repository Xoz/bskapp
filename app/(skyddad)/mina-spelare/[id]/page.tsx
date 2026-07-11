import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canAccessPlayer } from "@/lib/auth";
import { getEvaluations, getPlayer, getPlayerMatchStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function LinkedPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const playerId = Number((await params).id);
  if (!playerId || !(await canAccessPlayer(playerId))) redirect("/mina-spelare?behorighet=saknas");
  const [player, evaluations, matches] = await Promise.all([
    getPlayer(playerId),
    getEvaluations(playerId),
    getPlayerMatchStats(playerId),
  ]);
  if (!player) notFound();
  const latest = evaluations[0];
  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/mina-spelare" className="body-small" style={{ color: "var(--ink-secondary)" }}>← Mina spelare</Link>
      <header className="flex items-center gap-4"><span className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>{player.name[0]?.toUpperCase()}</span><div><h1 className="text-[32px] font-bold">{player.name}</h1><p className="body-small" style={{ color: "var(--ink-secondary)" }}>{player.position || "Spelare"}{player.jersey_number ? ` · #${player.jersey_number}` : ""}</p></div></header>
      {latest && <section className="card p-5 space-y-3"><p className="eyebrow">Senaste utvecklingssamtalet · {latest.date}</p>{latest.strengths && <div><h2 className="font-semibold text-sm">Styrkor</h2><p className="body-small mt-1" style={{ color: "var(--ink-secondary)" }}>{latest.strengths}</p></div>}{latest.development_goals && <div><h2 className="font-semibold text-sm">Nästa steg</h2><p className="body-small mt-1" style={{ color: "var(--ink-secondary)" }}>{latest.development_goals}</p></div>}</section>}
      <section className="card overflow-hidden"><div className="p-5" style={{ borderBottom: "1px solid var(--border)" }}><h2 className="font-semibold">Matcher</h2></div>{matches.length === 0 ? <p className="p-5 text-sm" style={{ color: "var(--ink-secondary)" }}>Inga matcher registrerade.</p> : matches.slice(0, 12).map((match) => <div key={match.match_id} className="px-5 py-3 flex justify-between gap-3 text-sm" style={{ borderTop: "1px solid var(--border)" }}><span>{match.date} · {match.opponent}</span><span style={{ color: "var(--ink-secondary)" }}>{match.goals} mål · {match.assists} assist</span></div>)}</section>
    </div>
  );
}
