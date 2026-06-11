import Link from "next/link";
import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getPlayers } from "@/lib/queries";
import MatchForm from "@/components/MatchForm";

export const dynamic = "force-dynamic";

export default async function NewMatchPage() {
  const role = await getRole();
  if (!role) redirect("/login");

  const players = getPlayers();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/matcher" className="text-sm font-medium" style={{ color: "var(--ink-soft)" }}>
          ← Matcher
        </Link>
        <h1 className="text-2xl font-bold mt-1">Registrera match</h1>
      </div>
      <MatchForm players={players} />
    </div>
  );
}
