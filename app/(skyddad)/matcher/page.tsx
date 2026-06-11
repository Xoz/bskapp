import Link from "next/link";
import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getMatches } from "@/lib/queries";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  seriespel: "Sammandrag/serie",
  cup: "Cup",
  traningsmatch: "Träningsmatch",
};

export default async function MatchesPage() {
  const role = await getRole();
  if (!role) redirect("/login");

  const matches = getMatches();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Matcher</h1>
          <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
            {role === "parent"
              ? "Tack för att du hjälper till med matchstatistiken! Klicka på en match eller registrera en ny."
              : `${matches.length} matcher registrerade`}
          </p>
        </div>
        <Link href="/matcher/ny" className="btn-primary">
          + Registrera match
        </Link>
      </div>

      {matches.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-medium mb-1">Inga matcher ännu</p>
          <p className="text-sm mb-4" style={{ color: "var(--ink-soft)" }}>
            Registrera lagets första match med speltid, mål och assist per spelare.
          </p>
          <Link href="/matcher/ny" className="btn-primary">Registrera match</Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Motståndare</th>
                <th>Typ</th>
                <th>Resultat</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => (
                <tr key={m.id}>
                  <td style={{ color: "var(--ink-soft)" }}>{m.date}</td>
                  <td>
                    <Link href={`/matcher/${m.id}`} className="font-medium hover:underline" style={{ color: "var(--primary)" }}>
                      {m.home_away === "home" ? "Hemma mot" : "Borta mot"} {m.opponent}
                    </Link>
                  </td>
                  <td>
                    <span className="badge" style={{ background: "#eef3ff", color: "var(--primary)" }}>
                      {TYPE_LABELS[m.match_type] ?? m.match_type}
                    </span>
                  </td>
                  <td className="font-semibold">
                    {m.our_score != null && m.opponent_score != null
                      ? `${m.our_score} – ${m.opponent_score}`
                      : "–"}
                  </td>
                  <td className="text-right">
                    <Link href={`/matcher/${m.id}`} className="text-sm font-medium" style={{ color: "var(--primary)" }}>
                      Öppna →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
        Enligt SvFF:s riktlinjer ligger fokus i barnfotbollen på utveckling och jämn speltid –
        inte på resultat och tabeller. Resultatet är frivilligt att fylla i.
      </p>
    </div>
  );
}
