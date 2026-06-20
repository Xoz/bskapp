import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getMatchesByCup, getPlayersLevelInfo, getGroupMemberIds } from "@/lib/queries";
import { updateCup, addCupPlayoffMatch, deleteCupMatch, deleteCup } from "@/lib/actions";
import { LEVELS } from "@/lib/levels";
import { IconArrowLeft, IconCheck, IconPlus } from "@/components/Icons";
import DeleteCupMatchButton from "@/components/DeleteCupMatchButton";
import DeleteCupButton from "@/components/DeleteCupButton";
import CupSquadPicker from "@/components/CupSquadPicker";

export const dynamic = "force-dynamic";

export default async function CupEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sparad?: string; grupp?: string }>;
}) {
  const role = await getRole();
  if (role !== "coach") redirect("/matcher");

  const { slug } = await params;
  const cupName = decodeURIComponent(slug);
  const { sparad, grupp } = await searchParams;
  const cupGroup = grupp ? decodeURIComponent(grupp) : "";

  const matches = await getMatchesByCup(cupName, cupGroup);
  if (matches.length === 0) notFound();

  const groupMatches = matches.filter((m) => m.cup_phase !== "playoff");
  const playoffMatches = matches.filter((m) => m.cup_phase === "playoff");
  const cupLevel = matches.find((m) => m.level)?.level ?? "";

  // Cupens matchgrupp = group_id på matcherna. Dess medlemskap är cupens uttagna
  // trupp (cupgemensam laguttagning), som blir default-trupp per match.
  const cupGroupId = matches.find((m) => m.group_id)?.group_id ?? null;
  const [playersInfo, cupSquadIds] = await Promise.all([
    getPlayersLevelInfo(),
    getGroupMemberIds(cupGroupId),
  ]);
  // cupGroup is already known from URL param — no need to re-read from matches
  // Matcherna i en cup delar speltidsformat – ta första matchens värden som default.
  const cupPeriods = matches[0].periods ?? 3;
  const cupPeriodMinutes = matches[0].period_minutes ?? 20;

  const first = [...matches].sort((a, b) => a.date.localeCompare(b.date))[0].date;
  const last = [...matches].sort((a, b) => b.date.localeCompare(a.date))[0].date;
  const dateRange = first === last ? first : `${first} – ${last}`;

  // Summera gjorda mål (our_score) över de matcher som är spelade.
  const goalsScored = matches.reduce((sum, m) => sum + (m.our_score ?? 0), 0);

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
          {dateRange} · {matches.length} matcher · {goalsScored} gjorda mål
        </p>
      </div>

      {sparad && (
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm"
          style={{ background: "var(--ok-bg)", color: "var(--ok)" }}
        >
          <IconCheck width={16} height={16} />
          {sparad === "trupp" ? "Uttagningen är sparad." : "Cupen är sparad."}
        </div>
      )}

      <form action={updateCup} className="space-y-6">
        <input type="hidden" name="original_cup_name" value={cupName} />
        <input type="hidden" name="original_cup_group" value={cupGroup} />
        <input type="hidden" name="match_ids" value={matches.map((m) => m.id).join(",")} />

        {/* Cupinställningar – gäller alla matcher i cupen */}
        <div className="card p-5 md:p-6 space-y-4">
          <div>
            <h2 className="font-semibold">Cupinställningar</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
              Gäller alla matcher i cupen.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="new_cup_name">Cup-namn</label>
              <input
                id="new_cup_name"
                name="new_cup_name"
                defaultValue={cupName}
                required
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="cup_group">Grupp <span style={{ color: "var(--ink-faint)", fontWeight: 400 }}>(valfri)</span></label>
              <input
                id="cup_group"
                name="cup_group"
                defaultValue={cupGroup}
                placeholder="t.ex. Grupp A"
                className="input"
              />
            </div>
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
                  <DeleteCupMatchButton action={deleteCupMatch.bind(null, m.id, cupName, cupGroup)} />
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
                    <DeleteCupMatchButton action={deleteCupMatch.bind(null, m.id, cupName, cupGroup)} />
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

        <div className="flex gap-3 flex-wrap items-center justify-between">
          <div className="flex gap-3 flex-wrap">
            <button type="submit" className="btn-primary px-6">Spara cup</button>
            <Link href="/matcher" className="btn-secondary">Avbryt</Link>
          </div>
          <DeleteCupButton
            action={deleteCup.bind(null, cupName, cupGroup)}
            cupName={cupName}
            matchCount={matches.length}
          />
        </div>
      </form>

      {/* Laguttagning – uttagna till cupen (cupgemensam trupp) */}
      <div className="card p-5 md:p-6 space-y-4">
        <div>
          <h2 className="font-semibold">Laguttagning</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
            Spelarna du tar ut här är cupens trupp och blir förvald i varje match. Du kan
            sedan justera startelva och avbytare per match.
          </p>
        </div>
        {playersInfo.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            Inga aktiva spelare i truppen ännu.
          </p>
        ) : (
          <CupSquadPicker
            cupName={cupName}
            cupGroup={cupGroup}
            cupLevel={cupLevel}
            players={playersInfo.map((p) => ({
              id: p.id,
              name: p.name,
              jersey_number: p.jersey_number,
              position: p.position,
              level: p.level,
            }))}
            initialSquad={cupSquadIds}
          />
        )}

        <div className="pt-1" style={{ borderTop: "1px solid var(--line)" }}>
          <p className="text-xs font-semibold mt-3 mb-2" style={{ color: "var(--ink-faint)" }}>
            Startelva per match
          </p>
          <div className="flex flex-col gap-1.5">
            {[
              ...groupMatches.map((m, i) => ({ m, label: `Match ${i + 1}` })),
              ...playoffMatches.map((m, i) => ({ m, label: `Slutspel ${i + 1}` })),
            ].map(({ m, label }) => (
              <Link
                key={m.id}
                href={`/matcher/${m.id}/laguttagning`}
                className="flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors hover:text-[var(--primary)]"
                style={{ background: "var(--bg2)", color: "var(--ink-soft)" }}
              >
                <span>
                  {label} · {m.home_away === "home" ? "hemma mot" : "borta mot"} {m.opponent}
                </span>
                <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
                  {m.date} →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

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
          <input type="hidden" name="cup_group" value={cupGroup} />
          <button type="submit" className="btn-secondary">
            <IconPlus width={15} height={15} /> Lägg till slutspelsmatch
          </button>
        </form>
      </div>
    </div>
  );
}
