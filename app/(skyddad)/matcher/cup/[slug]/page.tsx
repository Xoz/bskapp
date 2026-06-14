import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getMatchesByCup } from "@/lib/queries";
import { updateCup, addCupPlayoffMatch, deleteCupMatch } from "@/lib/actions";
import { LEVELS } from "@/lib/levels";
import { IconArrowLeft, IconCheck, IconPlus } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function CupEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sparad?: string }>;
}) {
  const role = await getRole();
  if (role !== "coach") redirect("/matcher");

  const { slug } = await params;
  const cupName = decodeURIComponent(slug);
  const { sparad } = await searchParams;

  const matches = await getMatchesByCup(cupName);
  if (matches.length === 0) notFound();

  const groupMatches = matches.filter((m) => m.cup_phase !== "playoff");
  const playoffMatches = matches.filter((m) => m.cup_phase === "playoff");
  const cupLevel = matches.find((m) => m.level)?.level ?? "";
  // Matcherna i en cup delar speltidsformat – ta första matchens värden som default.
  const cupPeriods = matches[0].periods ?? 3;
  const cupPeriodMinutes = matches[0].period_minutes ?? 20;

  const first = [...matches].sort((a, b) => a.date.localeCompare(b.date))[0].date;
  const last = [...matches].sort((a, b) => b.date.localeCompare(a.date))[0].date;
  const dateRange = first === last ? first : `${first} – ${last}`;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href="/matcher"
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-[var(--primary)]"
          style={{ color: "var(--ink-soft)", fontFamily: "var(--font-display)" }}
        >
          <IconArrowLeft width={15} height={15} /> Matcher
        </Link>
        <h1 className="text-[1.7rem] font-bold mt-2">{cupName}</h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
          {dateRange} · {matches.length} matcher
        </p>
      </div>

      {sparad && (
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm"
          style={{ background: "var(--ok-bg)", color: "var(--ok)" }}
        >
          <IconCheck width={16} height={16} />
          Cupen är sparad.
        </div>
      )}

      <form action={updateCup} className="space-y-6">
        <input type="hidden" name="cup_name" value={cupName} />
        <input type="hidden" name="match_ids" value={matches.map((m) => m.id).join(",")} />

        {/* Cupinställningar – gäller alla matcher i cupen */}
        <div className="card p-5 md:p-6 space-y-4">
          <div>
            <h2 className="font-semibold">Cupinställningar</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
              Gäller alla matcher i cupen.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="label" htmlFor="cup_level">Svårighetsnivå</label>
              <select id="cup_level" name="level" defaultValue={cupLevel} className="input">
                <option value="">Ej satt</option>
                {LEVELS.map((l) => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="cup_periods">Antal perioder</label>
              <input
                id="cup_periods"
                name="periods"
                type="number"
                min="1"
                max="9"
                defaultValue={cupPeriods}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="cup_period_minutes">Matchtid per period (min)</label>
              <input
                id="cup_period_minutes"
                name="period_minutes"
                type="number"
                min="1"
                max="90"
                defaultValue={cupPeriodMinutes}
                className="input"
              />
            </div>
          </div>
        </div>

        {/* Gruppspel */}
        <div className="card overflow-hidden">
          <div className="px-5 md:px-6 py-4" style={{ borderBottom: "1px solid var(--line)" }}>
            <h2 className="font-semibold">Gruppspel</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
              {groupMatches.length} matcher
            </p>
          </div>
          <div className="divide-y" style={{ "--tw-divide-opacity": 1 } as React.CSSProperties}>
            {groupMatches.map((m, i) => (
              <div key={m.id} className="px-5 md:px-6 py-4 space-y-3">
                <input type="hidden" name={`phase_${m.id}`} value="group" />
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold" style={{ color: "var(--ink-faint)" }}>
                    Match {i + 1}
                  </p>
                  <button
                    type="submit"
                    formAction={deleteCupMatch.bind(null, m.id, cupName)}
                    formNoValidate
                    className="text-xs px-2 py-0.5 rounded transition-colors hover:underline"
                    style={{ color: "var(--danger)" }}
                  >
                    Ta bort
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="label" htmlFor={`opponent_${m.id}`}>Motståndare</label>
                    <input
                      id={`opponent_${m.id}`}
                      name={`opponent_${m.id}`}
                      defaultValue={m.opponent}
                      required
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor={`home_away_${m.id}`}>Plats</label>
                    <select id={`home_away_${m.id}`} name={`home_away_${m.id}`} defaultValue={m.home_away} className="input">
                      <option value="home">Hemma</option>
                      <option value="away">Borta</option>
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor={`date_${m.id}`}>Datum</label>
                    <input
                      id={`date_${m.id}`}
                      name={`date_${m.id}`}
                      type="date"
                      defaultValue={m.date}
                      required
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor={`time_${m.id}`}>Avsparktid</label>
                    <input
                      id={`time_${m.id}`}
                      name={`time_${m.id}`}
                      type="time"
                      defaultValue={m.start_time ?? ""}
                      className="input"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Slutspel */}
        {playoffMatches.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-5 md:px-6 py-4" style={{ borderBottom: "1px solid var(--line)" }}>
              <h2 className="font-semibold">Slutspel</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
                {playoffMatches.length} matcher – uppdatera motståndare efter gruppspelet
              </p>
            </div>
            <div>
              {playoffMatches.map((m, i) => (
                <div
                  key={m.id}
                  className="px-5 md:px-6 py-4 space-y-3"
                  style={{ borderTop: i > 0 ? "1px solid var(--line)" : undefined }}
                >
                  <input type="hidden" name={`phase_${m.id}`} value="playoff" />
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold" style={{ color: "var(--ink-faint)" }}>
                      Slutspelsmatch {i + 1}
                    </p>
                    <button
                      type="submit"
                      formAction={deleteCupMatch.bind(null, m.id, cupName)}
                      formNoValidate
                      className="text-xs px-2 py-0.5 rounded transition-colors hover:underline"
                      style={{ color: "var(--danger)" }}
                    >
                      Ta bort
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="label" htmlFor={`po_opponent_${m.id}`}>Motståndare</label>
                      <input
                        id={`po_opponent_${m.id}`}
                        name={`opponent_${m.id}`}
                        defaultValue={m.opponent === "TBD" ? "" : m.opponent}
                        placeholder="Klart efter gruppspelet"
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor={`po_round_${m.id}`}>Omgång</label>
                      <select id={`po_round_${m.id}`} name={`round_${m.id}`} defaultValue={m.cup_round ?? ""} className="input">
                        <option value="">Välj omgång</option>
                        <option value="qf">Kvartsfinal</option>
                        <option value="sf">Semifinal</option>
                        <option value="bronze">Bronsmatch</option>
                        <option value="f">Final</option>
                      </select>
                    </div>
                    <div>
                      <label className="label" htmlFor={`po_home_away_${m.id}`}>Plats</label>
                      <select id={`po_home_away_${m.id}`} name={`home_away_${m.id}`} defaultValue={m.home_away} className="input">
                        <option value="home">Hemma</option>
                        <option value="away">Borta</option>
                      </select>
                    </div>
                    <div>
                      <label className="label" htmlFor={`po_date_${m.id}`}>Datum</label>
                      <input
                        id={`po_date_${m.id}`}
                        name={`date_${m.id}`}
                        type="date"
                        defaultValue={m.date}
                        required
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor={`po_time_${m.id}`}>Avsparktid</label>
                      <input
                        id={`po_time_${m.id}`}
                        name={`time_${m.id}`}
                        type="time"
                        defaultValue={m.start_time ?? ""}
                        className="input"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 flex-wrap items-center">
          <button type="submit" className="btn-primary px-6">Spara cup</button>
          <Link href="/matcher" className="btn-secondary">Avbryt</Link>
        </div>
      </form>

      {/* Lägg till slutspelsmatch */}
      <div className="card p-5 md:p-6">
        <h2 className="font-semibold mb-1">Slutspel</h2>
        <p className="text-sm mt-0.5 mb-4" style={{ color: "var(--ink-soft)" }}>
          {playoffMatches.length === 0
            ? "Cupen saknar slutspelsomgångar. Lägg till en match för varje slutspelsrunda."
            : `${playoffMatches.length} slutspelsmatch${playoffMatches.length !== 1 ? "er" : ""} tillagd${playoffMatches.length !== 1 ? "a" : ""}. Fyll i motståndare ovan efter gruppspelet.`}
        </p>
        <form action={addCupPlayoffMatch}>
          <input type="hidden" name="cup_name" value={cupName} />
          <button type="submit" className="btn-secondary">
            <IconPlus width={15} height={15} /> Lägg till slutspelsmatch
          </button>
        </form>
      </div>
    </div>
  );
}
