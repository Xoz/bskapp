import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllSettings } from "@/lib/db";
import { getMatchByCode, getMatchPlayers, getPlayers } from "@/lib/queries";
import { submitStatsByCode } from "@/lib/actions";
import { STAT_FIELDS } from "@/lib/stats";
import StatsFields from "@/components/StatsFields";
import { IconCheck, IconArrowLeft } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function ReportMatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ tack?: string }>;
}) {
  const { code } = await params;
  const { tack } = await searchParams;

  const match = getMatchByCode(code.replace(/\D/g, ""));
  if (!match) notFound();

  const settings = getAllSettings();
  const players = getPlayers();
  const matchPlayers = getMatchPlayers(match.id);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Matchhuvud */}
      <header
        className="px-4 py-8 md:py-10"
        style={{ background: "linear-gradient(160deg, var(--primary-dark), var(--primary-deep))" }}
      >
        <div className="max-w-3xl mx-auto">
          <Link
            href="/rapportera"
            className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white transition-colors"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <IconArrowLeft width={15} height={15} /> Annan matchkod
          </Link>
          <p className="eyebrow text-white/40 mt-5">{settings.team_name} · {match.date}</p>
          <h1
            className="text-2xl md:text-3xl font-bold text-white mt-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {match.home_away === "home" ? "Hemma mot" : "Borta mot"} {match.opponent}
          </h1>
          <p className="text-sm text-white/55 mt-2 max-w-lg">
            Tack för att du hjälper till! Bocka i de som spelade och räkna det du hinner – allt
            behöver inte fyllas i.
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 md:py-8 space-y-6 rise">
        {tack && (
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm"
            style={{ background: "var(--ok-bg)", color: "var(--ok)" }}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--ok)", color: "#fff" }}>
              <IconCheck width={15} height={15} />
            </span>
            Statistiken är sparad – tack för hjälpen! Du kan ändra och spara igen om du behöver.
          </div>
        )}

        <form action={submitStatsByCode} className="space-y-6">
          <input type="hidden" name="code" value={match.code} />

          <div className="card p-6 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="our_score">Våra mål (frivilligt)</label>
              <input id="our_score" name="our_score" type="number" min="0" defaultValue={match.our_score ?? ""} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="opponent_score">Motståndarens mål (frivilligt)</label>
              <input id="opponent_score" name="opponent_score" type="number" min="0" defaultValue={match.opponent_score ?? ""} className="input" />
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-6 py-5" style={{ borderBottom: "1px solid var(--line)" }}>
              <h2 className="font-semibold">Spelarstatistik</h2>
              <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
                {STAT_FIELDS.map((f) => `${f.short} = ${f.label}`).join(" · ")}
              </p>
            </div>
            <StatsFields players={players} matchPlayers={matchPlayers} />
          </div>

          <button type="submit" className="btn-primary w-full sm:w-auto px-8 py-3">
            Spara statistiken
          </button>
        </form>

        <p className="text-xs pb-8" style={{ color: "var(--ink-faint)" }}>
          Statistiken används av tränarna som stöd i spelarnas utveckling – aldrig för att ranka
          enskilda spelare.
        </p>
      </main>
    </div>
  );
}
