import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getMatch, getMatchPlayers, getPlayers } from "@/lib/queries";
import { deleteMatch } from "@/lib/actions";
import MatchForm from "@/components/MatchForm";
import { IconArrowLeft } from "@/components/Icons";

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
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/matcher"
            className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-[var(--primary)]"
            style={{ color: "var(--ink-soft)", fontFamily: "var(--font-display)" }}
          >
            <IconArrowLeft width={15} height={15} /> Matcher
          </Link>
          <h1 className="text-[1.7rem] font-bold mt-2">
            {match.home_away === "home" ? "Hemma mot" : "Borta mot"} {match.opponent}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
            {match.date}
            {match.our_score != null && match.opponent_score != null && (
              <>
                {" · Resultat "}
                <span className="stat-number" style={{ color: "var(--ink)" }}>
                  {match.our_score}–{match.opponent_score}
                </span>
              </>
            )}
          </p>
        </div>
        {role === "coach" && (
          <form action={deleteMatch}>
            <input type="hidden" name="id" value={match.id} />
            <button
              type="submit"
              className="text-sm hover:underline cursor-pointer"
              style={{ color: "var(--danger)" }}
            >
              Ta bort match
            </button>
          </form>
        )}
      </div>

      <MatchForm players={players} match={match} matchPlayers={matchPlayers} />
    </div>
  );
}
