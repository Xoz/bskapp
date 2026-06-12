import Link from "next/link";
import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getMatches, type Match as MatchType } from "@/lib/queries";
import { IconPlus, IconPitch, IconArrowRight } from "@/components/Icons";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  seriespel: "Sammandrag",
  cup: "Cup",
  traningsmatch: "Träningsmatch",
};

export default async function MatchesPage() {
  const role = await getRole();
  if (!role) redirect("/login");

  const matches = await getMatches();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow">Säsongen</p>
          <h1 className="text-[1.7rem] font-bold mt-0.5">Matcher</h1>
          <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
            {role === "parent"
              ? "Har du fått en matchkod? Rapportera statistik utan inloggning."
              : `${matches.length} ${matches.length === 1 ? "match registrerad" : "matcher registrerade"}`}
          </p>
        </div>
        {role === "coach" ? (
          <div className="flex gap-2.5">
            <Link href="/installningar" className="btn-secondary">
              Hämta från kalender
            </Link>
            <Link href="/matcher/ny" className="btn-primary">
              <IconPlus width={15} height={15} /> Lägg till match
            </Link>
          </div>
        ) : (
          <Link href="/rapportera" className="btn-primary">
            Rapportera med matchkod <IconArrowRight width={15} height={15} />
          </Link>
        )}
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
          {role === "coach" ? (
            <>
              <p className="text-sm mb-5 max-w-sm mx-auto" style={{ color: "var(--ink-soft)" }}>
                Koppla lagets kalender från svenskalag.se under Inställningar, eller lägg till en
                match manuellt.
              </p>
              <div className="flex gap-3 justify-center">
                <Link href="/installningar" className="btn-secondary">Till Inställningar</Link>
                <Link href="/matcher/ny" className="btn-primary">Lägg till match</Link>
              </div>
            </>
          ) : (
            <p className="text-sm max-w-sm mx-auto" style={{ color: "var(--ink-soft)" }}>
              Tränaren har inte lagt in några matcher ännu.
            </p>
          )}
        </div>
      ) : (
        <MatchSections matches={matches} role={role} />
      )}

      <p className="text-xs max-w-xl" style={{ color: "var(--ink-faint)" }}>
        Enligt SvFF:s riktlinjer ligger fokus i barnfotbollen på utveckling – inte på resultat och
        tabeller. Resultatet är frivilligt att fylla i.
      </p>
    </div>
  );
}

function MatchCard({ m, role, today }: { m: MatchType; role: string; today: string }) {
  const hasResult = m.our_score != null && m.opponent_score != null;
  return (
    <Link href={`/matcher/${m.id}`} className="card card-hover p-5 flex items-center gap-4">
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
          {role === "coach" && (
            <>
              {" · kod "}
              <span className="stat-number tracking-wider" style={{ color: "var(--ink-soft)" }}>
                {m.code}
              </span>
            </>
          )}
        </p>
      </div>
      {m.date === today && (
        <span className="badge" style={{ background: "var(--accent)", color: "var(--primary-deep)" }}>
          I dag
        </span>
      )}
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
}

function MatchSections({ matches, role }: { matches: MatchType[]; role: string }) {
  const today = new Date().toISOString().slice(0, 10);
  // Kommande närmast först, spelade senast först
  const upcoming = matches.filter((m) => m.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = matches.filter((m) => m.date < today);

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-baseline gap-2.5 mb-3">
          <h2 className="font-semibold text-[1.05rem]">Kommande</h2>
          <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
            {upcoming.length} matcher
          </span>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm card p-5" style={{ color: "var(--ink-soft)" }}>
            Inga kommande matcher – hämta från kalendern under Inställningar när nya matcher
            planerats.
          </p>
        ) : (
          <div className="grid gap-3">
            {upcoming.map((m) => (
              <MatchCard key={m.id} m={m} role={role} today={today} />
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <div className="flex items-baseline gap-2.5 mb-3">
            <h2 className="font-semibold text-[1.05rem]">Spelade</h2>
            <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
              {past.length} matcher
            </span>
          </div>
          <div className="grid gap-3">
            {past.map((m) => (
              <MatchCard key={m.id} m={m} role={role} today={today} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
