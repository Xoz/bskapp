import Link from "next/link";
import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import { getCurrentUser, ROLE_LABELS } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mina spelare" };

type LinkedPlayer = {
  id: number;
  name: string;
  jersey_number: number | null;
  position: string;
  relation: "self" | "parent";
  matches_played: number;
};

export default async function MyPlayersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const players = await all<LinkedPlayer>(
    `SELECT p.id, p.name, p.jersey_number, p.position, upl.relation,
            COUNT(DISTINCT mp.match_id)::int AS matches_played
     FROM user_player_links upl
     JOIN players p ON p.id = upl.player_id AND p.active = 1
     LEFT JOIN match_players mp ON mp.player_id = p.id
     WHERE upl.user_id = ?
     GROUP BY p.id, upl.relation
     ORDER BY lower(p.name)`,
    [user.id]
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <header><p className="eyebrow">{user.roles.map((role) => ROLE_LABELS[role]).join(" · ")}</p><h1 className="text-[32px] font-bold mt-0.5">{user.primaryRole === "parent" ? "Mina barn" : "Min profil"}</h1></header>
      {players.length === 0 ? (
        <div className="card p-6"><h2 className="font-semibold">Ingen spelare är kopplad ännu</h2><p className="body-small mt-2" style={{ color: "var(--ink-secondary)" }}>Be en administratör koppla ditt konto till rätt spelare.</p></div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {players.map((player) => (
            <Link key={`${player.id}-${player.relation}`} href={`/mina-spelare/${player.id}`} className="card p-5 block transition-opacity hover:opacity-85">
              <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-full font-bold" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>{player.name[0]?.toUpperCase()}</span><div><h2 className="font-semibold">{player.name}</h2><p className="caption" style={{ color: "var(--ink-muted)" }}>{player.position || "Spelare"}{player.jersey_number ? ` · #${player.jersey_number}` : ""}</p></div></div>
              <p className="body-small mt-4" style={{ color: "var(--ink-secondary)" }}>{player.matches_played} matcher registrerade</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
