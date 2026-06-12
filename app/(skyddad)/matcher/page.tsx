import Link from "next/link";
import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getMatches } from "@/lib/queries";
import { IconPlus, IconPitch } from "@/components/Icons";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  seriespel: "Sammandrag",
  cup: "Cup",
  traningsmatch: "Träningsmatch",
};

export default async function MatchesPage() {
  const role = await getRole();
  if (!role) redirect("/login");

  const matches = getMatches();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow">Säsongen</p>
          <h1 className="text-[1.7rem] font-bold mt-0.5">Matcher</h1>
          <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
            {role === "parent"
              ? "Tack för att du hjälper till med matchstatistiken!"
              : `${matches.length} ${matches.length === 1 ? "match registrerad" : "matcher registrerade"}`}
          </p>
        </div>
        <Link href="/matcher/ny" className="btn-primary">
          <IconPlus width={15} height={15} /> Registrera match
        </Link>
      </div>

      {matches.length === 0 ? (
        <div className="card p-10 text-center">
          <span
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
          >
            <IconPitch width={22} height={22} />
          </span>
          <p className="font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>
            Inga matcher ännu
          </p>
          <p className="text-sm mb-5 max-w-xs mx-auto" style={{ color: "var(--ink-soft)" }}>
            Registrera lagets första match med speltid, mål och assist per spelare.
          </p>
          <Link href="/matcher/ny" className="btn-primary">Registrera match</Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {matches.map((m) => {
            const hasResult = m.our_score != null && m.opponent_score != null;
            return (
              <Link key={m.id} href={`/matcher/${m.id}`} className="card card-hover p-5 flex items-center gap-4">
                <div
                  className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                >
                  <IconPitch width={20} height={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate" style={{ fontFamily: "var(--font-display)" }}>
                    {m.home_away === "home" ? "Hemma mot" : "Borta mot"} {m.opponent}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
                    {m.date}
                  </p>
                </div>
                <span className="badge hidden sm:inline-flex" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
                  {TYPE_LABELS[m.match_type] ?? m.match_type}
                </span>
                <span
                  className="stat-number text-lg w-16 text-right"
                  style={{ color: hasResult ? "var(--ink)" : "var(--ink-faint)" }}
                >
                  {hasResult ? `${m.our_score}–${m.opponent_score}` : "–"}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <p className="text-xs max-w-xl" style={{ color: "var(--ink-faint)" }}>
        Enligt SvFF:s riktlinjer ligger fokus i barnfotbollen på utveckling och jämn speltid – inte
        på resultat och tabeller. Resultatet är frivilligt att fylla i.
      </p>
    </div>
  );
}
