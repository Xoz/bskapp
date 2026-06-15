import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import {
  getPlayer,
  getEvaluations,
  getScores,
  getPlayerDevelopment,
  getPlayerMatchStats,
  getPlayerFormTrend,
  shareLinkActive,
  getLatestSelfEval,
  SHARE_TTL_MS,
  type PlayerMatchRow,
} from "@/lib/queries";
import { CATEGORIES, LEVELS } from "@/lib/svff";
import { POSITIONS } from "@/lib/positions";
import { LEVELS as MATCH_LEVELS, suggestLevel } from "@/lib/levels";
import { ratingBand, EXPECTATION_STEPS } from "@/lib/rating";
import { updatePlayer, removePlayer, deleteEvaluation, generateShareLink, revokeShareLink } from "@/lib/actions";
import DevelopmentChart from "@/components/DevelopmentChart";
import FormTrendChart from "@/components/FormTrendChart";
import SkillRadar from "@/components/SkillRadar";
import Avatar from "@/components/Avatar";
import CopyLinkButton from "@/components/CopyLinkButton";
import { STAT_FIELDS } from "@/lib/stats";
import { IconArrowLeft, IconPlus, IconSpark, IconTarget, IconAlert } from "@/components/Icons";

export const dynamic = "force-dynamic";

function categoryAverages(scores: Record<string, number>) {
  return CATEGORIES.map((cat) => {
    const levels = cat.skills.map((s) => scores[s.id]).filter((v): v is number => v != null);
    return {
      category: cat.short,
      value:
        levels.length > 0
          ? Math.round((levels.reduce((a, b) => a + b, 0) / levels.length) * 100) / 100
          : 0,
    };
  });
}

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const role = await getRole();
  if (role !== "coach") redirect("/matcher");

  const { id } = await params;
  const player = await getPlayer(Number(id));
  if (!player || !player.active) notFound();

  const shareSinceMs = player.share_expires ? player.share_expires - SHARE_TTL_MS : null;
  const shareSinceIso = shareSinceMs ? new Date(shareSinceMs).toISOString().replace("T", " ").slice(0, 19) : undefined;

  const [evaluations, development, matchStats, selfEval, formTrend] = await Promise.all([
    getEvaluations(player.id),
    getPlayerDevelopment(player.id),
    getPlayerMatchStats(player.id),
    getLatestSelfEval(player.id, shareSinceIso),
    getPlayerFormTrend(player.id),
  ]);
  const linkActive = shareLinkActive(player);
  const hoursLeft = linkActive ? Math.ceil((player.share_expires! - Date.now()) / 3_600_000) : 0;
  // Nivåförslag från senaste utvärderingens snitt
  const lastDev = development[development.length - 1];
  const evalAvg = lastDev && typeof lastDev.total === "number" ? lastDev.total : null;
  const suggestedLevel = suggestLevel(evalAvg);
  // Matchform (ELO) – vänligt band + trend, ej naket tal
  const formBand = player.form_rating != null ? ratingBand(player.form_rating) : null;
  const formLastTwo = formTrend.slice(-2);
  const formDir = formLastTwo.length === 2 ? Math.sign(formLastTwo[1].rating - formLastTwo[0].rating) : 0;
  const lastOutcome = formTrend.length
    ? EXPECTATION_STEPS.find((s) => s.key === formTrend[formTrend.length - 1].outcome) ?? null
    : null;

  const latest = evaluations[0];
  const previous = evaluations[1];
  const latestScores = latest ? await getScores(latest.id) : null;
  const previousScores = previous ? await getScores(previous.id) : null;
  // Förhämta alla utvärderingars nivåer för historiklistan
  const scoresByEval = new Map(
    await Promise.all(
      evaluations.map(async (ev) => [ev.id, await getScores(ev.id)] as const)
    )
  );

  return (
    <div className="space-y-6">
      <Link
        href="/spelare"
        className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-[var(--primary)]"
        style={{ color: "var(--ink-soft)", fontFamily: "var(--font-display)" }}
      >
        <IconArrowLeft width={15} height={15} /> Alla spelare
      </Link>

      {/* Spelarhuvud */}
      <div className="card p-6 md:p-7 flex items-center gap-5 flex-wrap">
        <Avatar name={player.name} jersey={player.jersey_number} size={64} />
        <div className="flex-1 min-w-40">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[1.6rem] font-bold leading-tight">{player.name}</h1>
            {player.jersey_number != null && (
              <span
                className="badge"
                style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
              >
                #{player.jersey_number}
              </span>
            )}
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
            {evaluations.length === 0
              ? "Ingen utvärdering ännu"
              : `${evaluations.length} ${evaluations.length === 1 ? "utvärdering" : "utvärderingar"} · senast ${latest.date}`}
          </p>
        </div>
        <Link href={`/spelare/${player.id}/utvardera`} className="btn-primary">
          <IconPlus width={15} height={15} /> Ny utvärdering
        </Link>
      </div>

      {/* Spelarens egen sida – tidsbegränsad delningslänk för spelarsamtal */}
      <div className="card p-5 space-y-3" style={{ background: "var(--primary-ghost)" }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-48">
            <p className="font-semibold text-sm">Spelarsamtal – personlig länk</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--ink-soft)" }}>
              Skapa en länk där {player.name.split(" ")[0]} kan se sin statistik och utveckling – med en peppande AI-hälsning skriven till henne. Länken gäller i 48 timmar och måste sedan förnyas.
            </p>
          </div>
          {linkActive ? (
            <span className="badge shrink-0" style={{ background: "var(--ok-bg)", color: "var(--ok)" }}>
              Aktiv · {hoursLeft} h kvar
            </span>
          ) : (
            <span className="badge shrink-0" style={{ background: "var(--surface-2, rgba(0,0,0,0.06))", color: "var(--ink-faint)" }}>
              Ingen aktiv länk
            </span>
          )}
        </div>
        {linkActive ? (
          <div className="flex items-center gap-3 flex-wrap">
            <CopyLinkButton code={player.share_token!} path="spelarkort" variant="light" label="Kopiera spelarlänk" />
            <Link
              href={`/spelarkort/${player.share_token}`}
              target="_blank"
              className="text-xs underline"
              style={{ color: "var(--ink-soft)" }}
            >
              Förhandsgranska
            </Link>
            <form action={generateShareLink}>
              <input type="hidden" name="id" value={player.id} />
              <button type="submit" className="text-xs underline cursor-pointer" style={{ color: "var(--ink-soft)" }}>
                Förnya 48 h
              </button>
            </form>
            <form action={revokeShareLink}>
              <input type="hidden" name="id" value={player.id} />
              <button type="submit" className="text-xs underline cursor-pointer" style={{ color: "var(--danger)" }}>
                Återkalla
              </button>
            </form>
          </div>
        ) : (
          <form action={generateShareLink}>
            <input type="hidden" name="id" value={player.id} />
            <button type="submit" className="btn-secondary py-2 px-4 text-sm">
              🔗 Skapa länk (gäller 48 h)
            </button>
          </form>
        )}
      </div>

      {/* Spelarens egenutvärdering (senaste för aktiv länk) */}
      {selfEval && (
        <div className="card p-6 space-y-5" style={{ border: "1px solid var(--primary-soft)" }}>
          <div>
            <p className="eyebrow mb-0.5" style={{ color: "var(--primary)" }}>Egenutvärdering</p>
            <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
              Inlämnad {selfEval.created_at.slice(0, 10)} – läs inför spelarsamtalet
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Roligt med fotboll", value: selfEval.fun_rating, emojis: ["😐","😊","😄"] },
              { label: "Hur det går", value: selfEval.progress_rating, emojis: ["😅","👍","🔥"] },
              { label: "Trivs i laget", value: selfEval.team_rating, emojis: ["😐","😊","🤝"] },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl py-3 px-2 text-center"
                style={{ background: "var(--primary-ghost)" }}
              >
                <p className="text-2xl">{item.emojis[item.value - 1]}</p>
                <p className="text-[0.65rem] mt-1 leading-tight" style={{ color: "var(--ink-soft)" }}>
                  {item.label}
                </p>
              </div>
            ))}
          </div>
          {(selfEval.best_at || selfEval.want_to_improve || selfEval.note_to_coach) && (
            <div className="grid md:grid-cols-2 gap-4">
              {selfEval.best_at && (
                <div>
                  <p className="label mb-1">Bra på</p>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                    {selfEval.best_at}
                  </p>
                </div>
              )}
              {selfEval.want_to_improve && (
                <div>
                  <p className="label mb-1">Vill bli bättre på</p>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                    {selfEval.want_to_improve}
                  </p>
                </div>
              )}
              {selfEval.note_to_coach && (
                <div className="md:col-span-2">
                  <p className="label mb-1">Till tränaren</p>
                  <p
                    className="text-sm leading-relaxed rounded-lg px-4 py-3"
                    style={{ background: "var(--bg2)", color: "var(--ink)" }}
                  >
                    {selfEval.note_to_coach}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {evaluations.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>
            Dags för första utvärderingen
          </p>
          <p className="text-sm mb-5 max-w-sm mx-auto" style={{ color: "var(--ink-soft)" }}>
            Gör den första utvärderingen för att börja följa {player.name.split(" ")[0]}s utveckling
            över tid.
          </p>
          <Link href={`/spelare/${player.id}/utvardera`} className="btn-primary">
            Utvärdera nu
          </Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <p className="eyebrow mb-0.5">Profil</p>
            <h2 className="font-semibold mb-1">Styrkeområden just nu</h2>
            <p className="text-xs mb-2" style={{ color: "var(--ink-faint)" }}>
              {latest.date}
              {previous ? ` jämfört med ${previous.date} (streckad)` : ""}
            </p>
            <SkillRadar
              data={categoryAverages(latestScores!)}
              compare={previousScores ? categoryAverages(previousScores) : undefined}
            />
          </div>
          <div className="card p-6">
            <p className="eyebrow mb-0.5">Resan</p>
            <h2 className="font-semibold mb-1">Utveckling över tid</h2>
            <p className="text-xs mb-2" style={{ color: "var(--ink-faint)" }}>
              Nivå per område vid varje utvärdering
            </p>
            <DevelopmentChart data={development} />
          </div>
        </div>
      )}

      {/* Matchform – ELO-baserat form-tal från matchbetygen */}
      {formBand && (
        <div className="card p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
            <div>
              <p className="eyebrow mb-0.5">Form</p>
              <h2 className="font-semibold mb-1">Matchform</h2>
              <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
                Bygger på betygen "mot förväntan" – nivåjusterat över matcher
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="badge"
                style={{ background: "var(--bg2)", color: formBand.color, fontSize: "0.78rem", fontWeight: 700 }}
              >
                {formBand.label}
              </span>
              {formDir !== 0 && (
                <span
                  className="text-lg"
                  title={formDir > 0 ? "Stigande form" : "Sjunkande form"}
                  style={{ color: formDir > 0 ? "#4ade80" : "var(--danger)" }}
                >
                  {formDir > 0 ? "▲" : "▼"}
                </span>
              )}
              {lastOutcome && (
                <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
                  senast: {lastOutcome.label.toLowerCase()}
                </span>
              )}
            </div>
          </div>
          {formTrend.length >= 2 ? (
            <FormTrendChart
              data={formTrend.map((p) => ({ date: p.date, opponent: p.opponent, rating: p.rating, outcome: p.outcome }))}
            />
          ) : (
            <p className="text-sm" style={{ color: "var(--ink-faint)" }}>
              Betygsätt fler matcher för att se en trend.
            </p>
          )}
        </div>
      )}

      {latest && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-6">
            <div className="flex items-center gap-2.5 mb-3">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: "var(--ok-bg)", color: "var(--ok)" }}
              >
                <IconSpark width={16} height={16} />
              </span>
              <h2 className="font-semibold">Styrkor</h2>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--ink-soft)" }}>
              {latest.strengths || "Inga noteringar i senaste utvärderingen."}
            </p>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-2.5 mb-3">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
              >
                <IconTarget width={16} height={16} />
              </span>
              <h2 className="font-semibold">Utvecklingsmål</h2>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--ink-soft)" }}>
              {latest.development_goals || "Inga noteringar i senaste utvärderingen."}
            </p>
          </div>
        </div>
      )}

      {evaluations.length > 0 && (
        <div className="card p-6 md:p-7">
          <h2 className="font-semibold mb-5">Alla utvärderingar</h2>
          <div className="space-y-7">
            {evaluations.map((ev) => {
              const scores = scoresByEval.get(ev.id) ?? {};
              return (
                <div
                  key={ev.id}
                  className="border-b last:border-b-0 pb-7 last:pb-0"
                  style={{ borderColor: "var(--line)" }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <p className="font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                      {ev.date}
                      {ev.coach_name && (
                        <span className="text-sm font-normal ml-2" style={{ color: "var(--ink-faint)", fontFamily: "var(--font-body)" }}>
                          av {ev.coach_name}
                        </span>
                      )}
                    </p>
                    <form action={deleteEvaluation}>
                      <input type="hidden" name="id" value={ev.id} />
                      <input type="hidden" name="player_id" value={player.id} />
                      <button
                        className="text-xs hover:underline cursor-pointer"
                        style={{ color: "var(--danger)" }}
                        type="submit"
                      >
                        Ta bort
                      </button>
                    </form>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                    {CATEGORIES.map((cat) => (
                      <div key={cat.id}>
                        <p
                          className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] mb-2"
                          style={{ color: cat.color, fontFamily: "var(--font-display)" }}
                        >
                          {cat.name}
                        </p>
                        {cat.skills.map((skill) => {
                          const level = scores[skill.id];
                          if (level == null) return null;
                          return (
                            <div key={skill.id} className="flex items-center justify-between gap-3 py-1">
                              <span className="text-sm truncate" style={{ color: "var(--ink-soft)" }}>
                                {skill.name}
                              </span>
                              <span
                                className="level-meter shrink-0"
                                title={LEVELS.find((l) => l.value === level)?.label}
                              >
                                {[1, 2, 3, 4].map((i) => (
                                  <i key={i} className={i <= level ? "on" : ""} />
                                ))}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Matchstatistik. matchStats = en rad per match spelaren deltog i (även
          nollmatcher). Vi visar alla och flaggar matcher utan registrerad
          statistik så tränaren kan öppna matchen och rätta en glömd rapportering. */}
      {(() => {
        const hasStats = (m: PlayerMatchRow) =>
          STAT_FIELDS.some((f) => ((m as unknown as Record<string, number>)[f.id] ?? 0) > 0);
        const participated = matchStats.length;
        if (participated === 0) return null;
        const missing = matchStats.filter((m) => !hasStats(m)).length;
        const totals = STAT_FIELDS.reduce((acc, f) => {
          acc[f.id] = matchStats.reduce((s, m) => s + ((m as unknown as Record<string, number>)[f.id] ?? 0), 0);
          return acc;
        }, {} as Record<string, number>);
        return (
          <div className="card p-6 md:p-7">
            <h2 className="font-semibold mb-1">Matchstatistik</h2>
            <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
              {`Spelat ${participated} ${participated === 1 ? "match" : "matcher"}`}
              {missing > 0 && <> · {missing} utan registrerad statistik</>}
            </p>
            {missing > 0 && (
              <p
                className="text-xs rounded-lg px-3.5 py-2.5 mt-3 mb-1 flex items-start gap-2"
                style={{ background: "var(--warn-bg)", color: "var(--warn)" }}
              >
                <IconAlert width={14} height={14} className="shrink-0 mt-0.5" />
                <span>
                  {missing === 1 ? "En match är" : `${missing} matcher är`} markerade utan statistik.
                  Det är oftast en glömd rapportering – öppna matchen för att fylla i.
                </span>
              </p>
            )}
            <div className="overflow-x-auto -mx-2 mt-4">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Match</th>
                    {STAT_FIELDS.map((f) => (
                      <th key={f.id} title={f.label}>{f.short}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matchStats.map((m) => {
                    const row = m as unknown as Record<string, number>;
                    const hasResult = m.our_score != null && m.opponent_score != null;
                    const empty = !hasStats(m);
                    return (
                      <tr key={m.match_id} style={empty ? { background: "var(--warn-bg)" } : undefined}>
                        <td>
                          <Link
                            href={`/matcher/${m.match_id}`}
                            className="hover:underline font-medium whitespace-nowrap inline-flex items-center gap-1.5"
                            style={{ color: empty ? "var(--warn)" : "var(--primary)" }}
                          >
                            {m.opponent}
                            {empty && <span title="Ingen statistik registrerad"><IconAlert width={12} height={12} /></span>}
                          </Link>
                          <span className="block text-[0.7rem]" style={{ color: "var(--ink-faint)" }}>
                            {empty ? "Saknar statistik – tryck för att rätta" : `${m.date}${hasResult ? ` · ${m.our_score}–${m.opponent_score}` : ""}`}
                          </span>
                        </td>
                        {STAT_FIELDS.map((f) => (
                          <td key={f.id} style={empty ? { color: "var(--ink-faint)" } : undefined}>{row[f.id] || 0}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--line-strong)", fontWeight: 600 }}>
                    <td>Totalt</td>
                    {STAT_FIELDS.map((f) => (
                      <td key={f.id}>{totals[f.id]}</td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })()}

      <div className="card p-6 md:p-7">
        <h2 className="font-semibold mb-5">Redigera spelare</h2>
        <form action={updatePlayer} className="space-y-4 max-w-lg">
          <input type="hidden" name="id" value={player.id} />
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label" htmlFor="name">Namn</label>
              <input id="name" name="name" defaultValue={player.name} required className="input" />
            </div>
            <div className="w-24">
              <label className="label" htmlFor="jersey_number">Tröjnr</label>
              <input
                id="jersey_number"
                name="jersey_number"
                type="number"
                min="1"
                max="99"
                defaultValue={player.jersey_number ?? ""}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="position">Position</label>
            <select id="position" name="position" defaultValue={player.position ?? ""} className="input">
              <option value="">Ej angiven</option>
              {POSITIONS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
              Hjälper AI:n tolka matchstatistiken rätt – t.ex. att en back inte bedöms på antal mål.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="level">Spelnivå</label>
            <select id="level" name="level" defaultValue={player.level ?? ""} className="input">
              <option value="">Ej graderad</option>
              {MATCH_LEVELS.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
            <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
              {suggestedLevel
                ? <>Förslag från utvärderingen: <strong style={{ color: "var(--ink-soft)" }}>{suggestedLevel.label}</strong>. Styr laguttagningen till matcher.</>
                : "Gör en utvärdering för att få ett nivåförslag. Styr laguttagningen till matcher."}
            </p>
          </div>
          <div>
            <label className="label" htmlFor="notes">Anteckningar (syns bara för tränare)</label>
            <textarea id="notes" name="notes" rows={3} defaultValue={player.notes} className="input" />
          </div>
          <button type="submit" className="btn-primary">Spara</button>
        </form>
        <hr className="divider my-5" />
        <form action={removePlayer}>
          <input type="hidden" name="id" value={player.id} />
          <button
            type="submit"
            className="text-sm hover:underline cursor-pointer"
            style={{ color: "var(--danger)" }}
          >
            Ta bort spelaren från truppen (historiken sparas)
          </button>
        </form>
      </div>
    </div>
  );
}
