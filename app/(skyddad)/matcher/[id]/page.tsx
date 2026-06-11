import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getMatch, getMatchPlayers, getPlayers } from "@/lib/queries";
import { deleteMatch } from "@/lib/actions";
import MatchForm from "@/components/MatchForm";

export const dynamic = "force-dynamic";

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const role = await getRole();
  if (!role) redirect("/login");

  const { id } = await params;
  const match = getMatch(Number(id));
  if (!match) notFound();

  const players = getPlayers();
  const matchPlayers = getMatchPlayers(match.id);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/matcher" className="text-sm font-medium" style={{ color: "var(--ink-soft)" }}>
            ← Matcher
          </Link>
          <h1 className="text-2xl font-bold mt-1">
            {match.home_away === "home" ? "Hemma mot" : "Borta mot"} {match.opponent}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
            {match.date}
            {match.our_score != null && match.opponent_score != null &&
              ` · Resultat ${match.our_score} – ${match.opponent_score}`}
          </p>
        </div>
        {role === "coach" && (
          <form action={deleteMatch}>
            <input type="hidden" name="id" value={match.id} />
            <button type="submit" className="text-sm text-red-500 hover:underline cursor-pointer">
              Ta bort match
            </button>
          </form>
        )}
      </div>

      <MatchForm players={players} match={match} matchPlayers={matchPlayers} />
    </div>
  );
}
