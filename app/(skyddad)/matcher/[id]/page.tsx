import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, getRole } from "@/lib/auth";
import { getMatch, getMatchPlayers, getPlayers, getMatchEvents, getMatchReporters, getMatchSquad } from "@/lib/queries";
import { createMatchEvaluationInvite, deleteMatch, resetMatch, revokeMatchEvaluationInvite, toggleMatchReporting } from "@/lib/actions";
import { STAT_FIELDS } from "@/lib/stats";
import { level as levelInfo } from "@/lib/levels";
import { FEATURES } from "@/lib/features";
import { getMatchEvaluationInvites, getMatchEvaluationStatus, matchEvaluationIsOpen } from "@/lib/matchEvaluation";
import LiveFeed from "@/components/LiveFeed";
import Avatar from "@/components/Avatar";
import ConfirmForm from "@/components/ConfirmForm";
import ManualEventForm from "@/components/ManualEventForm";
import EventEditor from "@/components/EventEditor";
import CopyLinkButton from "@/components/CopyLinkButton";
import { IconArrowLeft, IconArrowRight, IconLive } from "@/components/Icons";
import { swedishToday, reportingAutoOpen } from "@/lib/dates";
import { getSelectionMatches } from "@/lib/developmentCore";
import { getOrganizationGroups } from "@/lib/organization";
import { resolveMatchRoster } from "@/lib/matchRoster";

export const dynamic = "force-dynamic";

export default async function MatchPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ evalLink?: string }>;
}) {
  const [role, user] = await Promise.all([getRole(), getCurrentUser()]);
  if (!role || !user) redirect("/login");

  const { id } = await params;
  const match = await getMatch(Number(id));
  if (!match) notFound();

  const canManageSquads = user.permissions.includes("manage_squads");
  const canReportMatches = user.permissions.includes("report_matches");
  const canManageEvaluations = user.permissions.includes("manage_evaluations");
  const [players, matchPlayers, events, reporters, squadIds, evaluationStatus, evaluationInvites, groups, selectionMatches, roster] = await Promise.all([
    getPlayers(),
    getMatchPlayers(match.id),
    getMatchEvents(match.id),
    getMatchReporters(match.id),
    getMatchSquad(match.id),
    getMatchEvaluationStatus(match.id),
    getMatchEvaluationInvites(match.id),
    getOrganizationGroups(),
    canManageSquads ? getSelectionMatches() : Promise.resolve([]),
    resolveMatchRoster(match.id),
  ]);
  const { evalLink } = await searchParams;
  const mLevel = levelInfo(match.level);
  const today = swedishToday();
  const isUpcoming = match.date >= today;
  const matchGroup = groups.find((group) => group.id === match.group_id);
  const isYellowMatch = matchGroup?.name === "Gul";
  const evaluationOpen = matchEvaluationIsOpen(match.date, match.start_time);
  const selectionActivity = selectionMatches.find((activity) => activity.match_id === match.id);
  const selectionHref = selectionActivity
    ? `/uttagning?aktivitet=${encodeURIComponent(selectionActivity.id)}`
    : `#trupp`;
  // Föräldrarapporteringen öppnar automatiskt 60 min före avspark (svensk tid).
  // report_open är tränarens manuella override – effektivt öppen = endera.
  const reportAutoOpen = !match.finished && reportingAutoOpen(match.date, match.start_time);
  const reportOpen = !!match.report_open || reportAutoOpen;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/matcher"
            className="inline-flex items-center gap-1.5 body-small font-medium transition-colors"
            style={{ color: "var(--ink-secondary)" }}
          >
            <IconArrowLeft width={15} height={15} /> Matcher
          </Link>
          <h1 className="mt-2 flex items-center gap-3 flex-wrap" style={{ fontSize: "32px" }}>
            {match.home_away === "home" ? "Hemma mot" : "Borta mot"} {match.opponent}
            {mLevel && (
              <span className="badge level-tag" data-level={mLevel.id} style={{ background: "var(--elevated)" }}>
                {mLevel.label}
              </span>
            )}
          </h1>
          <p className="body-small mt-1" style={{ color: "var(--ink-secondary)" }}>
            {match.date}{match.start_time ? ` · ${match.start_time}` : ""}
            {match.location ? ` · ${match.location}` : ""}
            {match.source === "calendar" && " · hämtad från kalendern"}
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
          <div className="flex gap-3 items-center">
            <ConfirmForm
              action={resetMatch}
              message="Nollställa all statistik och klocka för den här matchen?"
            >
              <input type="hidden" name="id" value={match.id} />
              <button type="submit" className="body-small hover:underline cursor-pointer" style={{ color: "var(--ink-muted)" }}>
                Nollställ match
              </button>
            </ConfirmForm>
            <ConfirmForm
              action={deleteMatch}
              message="Ta bort matchen permanent?"
            >
              <input type="hidden" name="id" value={match.id} />
              <button type="submit" className="body-small hover:underline cursor-pointer" style={{ color: "var(--danger)" }}>
                Ta bort match
              </button>
            </ConfirmForm>
          </div>
        )}
      </div>

      {role === "coach" && (
        <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Matchområden">
          <Link href={`/matcher/${match.id}`} className="badge badge-primary whitespace-nowrap">Översikt</Link>
          <Link href={selectionHref} className="badge whitespace-nowrap" style={{ background: "var(--surface)" }}>Trupp</Link>
          {FEATURES.liveScore && isYellowMatch && canReportMatches && (
            <Link href={`/matcher/${match.id}/live`} className="badge whitespace-nowrap" style={{ background: "var(--surface)" }}>Matchcenter</Link>
          )}
          {isYellowMatch && canManageEvaluations && evaluationOpen && (
            <Link href={`/matcher/${match.id}/utvardera`} className="badge whitespace-nowrap" style={{ background: "var(--surface)" }}>Utvärdera</Link>
          )}
        </nav>
      )}

      {/* Matchsammanställning – totaler, synlig för båda roller */}
      {matchPlayers.length > 0 && (() => {
        const totals = STAT_FIELDS.map((f) => ({
          ...f,
          total: matchPlayers.reduce((sum, mp) => sum + ((mp as unknown as Record<string, number>)[f.id] ?? 0), 0),
        }));

        // Räkna händelser per reporter – skiftlägesokänsligt (slå ihop t.ex.
        // "Itzas Pappa" och "itzas pappa"), behåll först sedda stavningen
        const reporterCounts: Record<string, { name: string; count: number }> = {};
        for (const ev of events) {
          const name = reporters[ev.stat_id];
          if (!name) continue;
          const key = name.toLowerCase();
          if (!reporterCounts[key]) reporterCounts[key] = { name, count: 0 };
          reporterCounts[key].count++;
        }
        const reporterRanking = Object.values(reporterCounts)
          .map((r) => [r.name, r.count] as [string, number])
          .sort((a, b) => b[1] - a[1]);

        return (
          <details className="card overflow-hidden">
            <summary className="p-5 md:p-6 flex items-center justify-between cursor-pointer list-none select-none">
              <h2 className="font-semibold body">Matchsammanställning</h2>
              <IconArrowRight width={14} height={14} className="details-chevron shrink-0" style={{ color: "var(--ink-muted)" }} />
            </summary>
            <div className="px-5 md:px-6 pb-5 md:pb-6" style={{ borderTop: "1px solid var(--border)" }}>
              <div className="grid grid-cols-3 sm:grid-cols-7 gap-3 pt-5">
                {totals.map((f) => (
                  <div key={f.id} className="text-center py-3 px-2" style={{ background: "var(--surface)", borderRadius: "var(--r-button)" }}>
                    <p className="stat-number" style={{ fontSize: "24px" }}>{f.total}</p>
                    <p className="caption mt-1" style={{ color: "var(--ink-muted)" }}>{f.short}</p>
                  </div>
                ))}
              </div>
              {reporterRanking.length > 0 && (
                <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                  <p className="caption font-semibold mb-2" style={{ color: "var(--ink-secondary)" }}>Bästa rapportör</p>
                  <div className="flex flex-wrap gap-2">
                    {reporterRanking.map(([name, count], i) => (
                      <span
                        key={name}
                        className="flex items-center gap-1.5 body-small"
                        style={{
                          borderRadius: "var(--r-badge)",
                          padding: "4px 12px",
                          background: i === 0 ? "var(--primary-soft)" : "var(--surface)",
                          color: i === 0 ? "var(--primary)" : "var(--ink-secondary)",
                          fontWeight: i === 0 ? 600 : 400,
                        }}
                      >
                        {i === 0 && <span>🏆</span>}
                        {name}
                        <span className="stat-number caption opacity-70">{count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>
        );
      })()}

      {role === "coach" && (
        <>
          {/* Samma kanoniska trupp som native: spelad match visar deltagare,
              kommande match visar selected från match_roster. */}
          {(() => {
            const content = <>
              <span className="text-2xl">📋</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold body">Trupp</p>
                <p className="caption mt-0.5" style={{ color: "var(--ink-secondary)" }}>
                  {roster && roster.players.length > 0
                    ? `${roster.label}: ${roster.players.map((player) => player.name).join(", ")}`
                    : "Ingen trupp registrerad"}
                </p>
              </div>
              {canManageSquads && selectionActivity && (
                <span className="badge badge-primary">{squadIds.length > 0 ? "Ändra" : "Öppna"}</span>
              )}
            </>;
            return canManageSquads && selectionActivity ? (
              <Link id="trupp" href={selectionHref} className="card card-hover p-5 flex items-center gap-4" style={isUpcoming ? { background: "var(--primary-ghost)", border: "1px solid var(--primary-soft)" } : undefined}>
                {content}
              </Link>
            ) : (
              <section id="trupp" className="card p-5 flex items-center gap-4 scroll-mt-20">{content}</section>
            );
          })()}

          {/* Liverapportering (dold när liveScore är av) */}
          {FEATURES.liveScore && isYellowMatch && canReportMatches && (
          <Link
            href={`/matcher/${match.id}/live`}
            className="card card-hover p-5 flex items-center gap-4"
            style={
              match.date === today && !match.finished
                ? { background: "var(--primary-ghost)", border: "1px solid var(--primary-soft)" }
                : undefined
            }
          >
            <span className="text-2xl">⏱️</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold body">Liverapportering</p>
              <p className="caption mt-0.5" style={{ color: "var(--ink-secondary)" }}>
                {match.finished
                  ? "Matchen är avslutad – öppna för att se eller rätta"
                  : events.length > 0
                    ? `${events.length} händelser rapporterade · fortsätt rapportera`
                    : "Starta matchklockan och rapportera mål, skott och byten live"}
              </p>
            </div>
            <span className="badge badge-primary">
              {match.finished ? "Visa" : events.length > 0 ? "Fortsätt" : "Starta"}
            </span>
          </Link>
          )}

          {/* Föräldrarapportering – publik Livescore + tränar-toggle för hjälpare (dold när liveScore är av) */}
          {FEATURES.liveScore && isYellowMatch && canReportMatches && !match.finished && (
            <div
              className="card p-5 flex items-center gap-4 flex-wrap"
              style={reportOpen ? { background: "var(--primary-ghost)", border: "1px solid var(--primary-soft)" } : undefined}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
              >
                <IconLive width={20} height={20} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold body">Föräldrarapportering</p>
                <p className="caption mt-0.5" style={{ color: "var(--ink-secondary)" }}>
                  {match.report_open
                    ? "Öppen – föräldrar kan hjälpa till att rapportera. Alla kan följa Livescore."
                    : reportAutoOpen
                    ? "Öppen automatiskt (60 min före avspark) – föräldrar kan hjälpa till att rapportera. Alla kan följa Livescore."
                    : match.start_time
                    ? "Öppnar automatiskt 60 min före avspark – eller öppna direkt. Livescore är alltid öppen att följa."
                    : "Stängd – sätt en avsparktid så öppnas den automatiskt, eller öppna manuellt. Livescore är alltid öppen att följa."}
                </p>
                <div className="mt-2">
                  <CopyLinkButton code={String(match.id)} path="live" variant="light" label="Kopiera Livescore-länk" />
                  {reportOpen && (
                    <span className="ml-2 inline-flex">
                      <CopyLinkButton
                        code={`${match.id}/rapportera?token=${encodeURIComponent(match.report_token)}`}
                        path="live"
                        variant="light"
                        label="Kopiera rapporteringslänk"
                      />
                    </span>
                  )}
                </div>
              </div>
              <form action={toggleMatchReporting}>
                <input type="hidden" name="id" value={match.id} />
                <input type="hidden" name="open" value={match.report_open ? "0" : "1"} />
                <button
                  type="submit"
                  className="btn-secondary"
                  style={match.report_open ? { color: "var(--danger)" } : undefined}
                >
                  {match.report_open ? "Stäng rapportering" : reportAutoOpen ? "Lås öppen" : "Öppna nu"}
                </button>
              </form>
            </div>
          )}

          {isYellowMatch && canManageEvaluations && evaluationOpen && evaluationStatus.total > 0 && (
            <section className="card p-5 md:p-6 space-y-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-semibold body">Matchutvärdering</p>
                  <p className="caption mt-1" style={{ color: "var(--ink-secondary)" }}>
                    {evaluationStatus.evaluated} av {evaluationStatus.total} spelare utvärderade
                    {evaluationStatus.contributors > 0 ? ` · ${evaluationStatus.contributors} bedömare` : ""}
                  </p>
                </div>
                <Link href={`/matcher/${match.id}/utvardera`} className="btn-primary">
                  {evaluationStatus.evaluated ? "Fortsätt" : "Utvärdera match"}
                </Link>
              </div>

              <div style={{ borderTop: "1px solid var(--border)" }} className="pt-5">
                <p className="label">Bjud in bedömare utan konto</p>
                <form action={createMatchEvaluationInvite} className="flex gap-2 mt-2 flex-wrap">
                  <input type="hidden" name="match_id" value={match.id} />
                  <input className="input flex-1 min-w-48" name="label" required maxLength={80} placeholder="Exempel: Johan, assisterande tränare" />
                  <button className="btn-secondary" type="submit">Skapa länk</button>
                </form>
                {evalLink && (
                  <div className="core-panel p-4 mt-3 flex items-center justify-between gap-3 flex-wrap">
                    <p className="body-small">Länken är skapad och gäller i sju dagar.</p>
                    <CopyLinkButton code={evalLink} path="matchutvardering" label="Kopiera utvärderingslänk" />
                  </div>
                )}
                {evaluationInvites.length > 0 && <div className="space-y-2 mt-3">
                  {evaluationInvites.map((invite) => <div key={invite.id} className="flex items-center justify-between gap-3 body-small">
                    <span>{invite.label} · {invite.completed_count} svar {invite.revoked_at && "· återkallad"}</span>
                    {!invite.revoked_at && <form action={revokeMatchEvaluationInvite}>
                      <input type="hidden" name="match_id" value={match.id} />
                      <input type="hidden" name="invite_id" value={invite.id} />
                      <button className="body-small hover:underline cursor-pointer" style={{ color: "var(--danger)" }}>Återkalla</button>
                    </form>}
                  </div>)}
                </div>}
              </div>
            </section>
          )}

          {FEATURES.matchStats && canReportMatches && events.length > 0 && (
            <details className="card overflow-hidden">
              <summary className="p-6 flex items-center justify-between cursor-pointer list-none select-none">
                <h2 className="font-semibold body">Matchflöde</h2>
                <IconArrowRight width={14} height={14} className="details-chevron shrink-0" style={{ color: "var(--ink-muted)" }} />
              </summary>
              <div className="px-6 pb-6" style={{ borderTop: "1px solid var(--border)" }}>
                <p className="caption mt-4 mb-5" style={{ color: "var(--ink-muted)" }}>
                  Live-rapporterade händelser – tiderna gör det lätt att hitta rätt i matchvideon.
                </p>
                <LiveFeed events={events} opponent={match.opponent} reporters={reporters} />
              </div>
            </details>
          )}

          {FEATURES.matchStats && canReportMatches && events.length > 0 && (
            <details className="card overflow-hidden">
              <summary className="p-6 flex items-center justify-between cursor-pointer list-none select-none">
                <div className="flex items-baseline gap-3">
                  <h2 className="font-semibold body">Rätta statistik</h2>
                  <span className="caption" style={{ color: "var(--ink-muted)" }}>{events.length} händelser</span>
                </div>
                <IconArrowRight width={14} height={14} className="details-chevron shrink-0" style={{ color: "var(--ink-muted)" }} />
              </summary>
              <div className="px-6 pb-6" style={{ borderTop: "1px solid var(--border)" }}>
                <p className="caption mt-4 mb-4" style={{ color: "var(--ink-muted)" }}>
                  Ta bort felaktiga rapporteringar – matchflöde och spelarpoäng justeras automatiskt.
                </p>
                <EventEditor events={events} matchId={match.id} reporters={reporters} />
              </div>
            </details>
          )}

          {FEATURES.matchStats && canReportMatches && (
          <details className="card overflow-hidden">
            <summary className="p-6 md:p-7 flex items-center justify-between cursor-pointer list-none select-none">
              <h2 className="font-semibold body">Lägg till händelse</h2>
              <IconArrowRight width={14} height={14} className="details-chevron shrink-0" style={{ color: "var(--ink-muted)" }} />
            </summary>
            <div className="px-6 md:px-7 pb-6 md:pb-7" style={{ borderTop: "1px solid var(--border)" }}>
              <p className="caption mt-4 mb-5" style={{ color: "var(--ink-muted)" }}>
                Komplettera statistik vid videogenomgång – händelsen sparas i matchflödet.
              </p>
              <ManualEventForm matchId={match.id} players={players} periods={match.periods} />
            </div>
          </details>
          )}

        </>
      )}
    </div>
  );
}
