import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import {
  getDevelopmentCheckpointSkills,
  getDevelopmentCheckpoints,
  getEvaluations,
  getLatestSelfEval,
  getPlayer,
  getPlayerSkillNote,
  getPlayerSkillStatuses,
} from "@/lib/queries";
import { CATEGORIES, skill as skillById, STATUS_LABEL } from "@/lib/skillTrappan";
import Avatar from "@/components/Avatar";
import UtvecklingChecklist from "@/components/UtvecklingChecklist";
import { IconArrowLeft, IconPlus, IconSpark, IconTarget } from "@/components/Icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Spelarens utveckling" };

export default async function PlayerDevelopmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sparad?: string }>;
}) {
  const role = await getRole();
  if (role !== "coach") redirect("/matcher");

  const { id } = await params;
  const player = await getPlayer(Number(id));
  if (!player || !player.active) notFound();

  const [statuses, note, checkpoints, legacyEvaluations, selfEval, query] = await Promise.all([
    getPlayerSkillStatuses(player.id),
    getPlayerSkillNote(player.id),
    getDevelopmentCheckpoints(player.id),
    getEvaluations(player.id),
    getLatestSelfEval(player.id),
    searchParams,
  ]);
  const checkpointSkills = new Map(
    await Promise.all(checkpoints.map(async (checkpoint) => [checkpoint.id, await getDevelopmentCheckpointSkills(checkpoint.id)] as const))
  );
  const latest = checkpoints[0] ?? null;
  const latestSkills = latest ? checkpointSkills.get(latest.id) ?? [] : [];
  const focusIds = latestSkills.filter((item) => item.is_focus).map((item) => item.skill_id);
  const firstName = player.name.replace(/^Exempel:\s*/, "").split(" ")[0];

  return (
    <div className="space-y-8 max-w-4xl">
      <Link
        href={`/spelare/${player.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-[var(--primary)]"
        style={{ color: "var(--ink-secondary)", fontFamily: "var(--font-display)" }}
      >
        <IconArrowLeft width={15} height={15} /> {player.name}
      </Link>

      {query.sparad === "1" && (
        <div className="rounded-xl p-4 body-small" style={{ background: "var(--ok-bg)", border: "1px solid var(--success)", color: "var(--success)" }}>
          Utvecklingsavstämningen är sparad. Trädet och historiken visar nu samma nuläge.
        </div>
      )}

      <div className="card p-6 md:p-7 flex items-center gap-5 flex-wrap">
        <Avatar name={player.name} jersey={player.jersey_number} size={64} />
        <div className="flex-1 min-w-48">
          <p className="eyebrow">Spelarens utveckling · 7v7 → 9v9</p>
          <h1 className="text-[1.65rem] font-bold leading-tight mt-0.5">{player.name}</h1>
          <p className="body-small mt-1" style={{ color: "var(--ink-secondary)" }}>
            {latest ? `Senaste avstämning ${latest.date}${latest.coach_name ? ` · ${latest.coach_name}` : ""}` : "Ingen avstämning ännu"}
          </p>
        </div>
        <Link href={`/spelare/${player.id}/utveckling/avstamning`} className="btn-primary">
          <IconPlus width={15} height={15} /> Ny avstämning
        </Link>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Delar på utvecklingssidan">
        <a href="#oversikt" className="btn-secondary btn-sm">Översikt</a>
        <a href="#fardigheter" className="btn-secondary btn-sm">Färdigheter</a>
        <a href="#historik" className="btn-secondary btn-sm">Avstämningar</a>
      </nav>

      <section id="oversikt" className="scroll-mt-6 space-y-4">
        <div>
          <p className="eyebrow">Översikt</p>
          <h2 className="text-xl font-semibold mt-0.5">Nuläge och nästa steg</h2>
        </div>

        {latest ? (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="card p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--ok-bg)", color: "var(--success)" }}>
                  <IconSpark width={16} height={16} />
                </span>
                <h3 className="font-semibold">Styrkor just nu</h3>
              </div>
              <p className="body-small whitespace-pre-wrap" style={{ color: "var(--ink-secondary)" }}>
                {latest.strengths || "Inga styrkor noterades i den senaste avstämningen."}
              </p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
                  <IconTarget width={16} height={16} />
                </span>
                <h3 className="font-semibold">Nästa fokus</h3>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {focusIds.map((skillId) => {
                  const skill = skillById(skillId);
                  const cat = skill ? CATEGORIES.find((item) => item.id === skill.category) : null;
                  return skill ? <span key={skillId} className="badge badge-primary">{cat?.icon} {skill.title}</span> : null;
                })}
                {focusIds.length === 0 && <span className="caption" style={{ color: "var(--ink-muted)" }}>Inga fokusfärdigheter valda.</span>}
              </div>
              <p className="body-small whitespace-pre-wrap" style={{ color: "var(--ink-secondary)" }}>
                {latest.focus_note || "Ingen särskild fokusanteckning."}
              </p>
            </div>
            <div className="card p-5 md:col-span-2">
              <p className="eyebrow mb-2">Mående och spelarens röst</p>
              <p className="body-small whitespace-pre-wrap" style={{ color: "var(--ink-secondary)" }}>
                {latest.wellbeing_note || selfEval?.note_to_coach || selfEval?.want_to_improve || "Inga aktuella noteringar om mående eller spelarens upplevelse."}
              </p>
              {selfEval && (
                <p className="caption mt-3" style={{ color: "var(--ink-muted)" }}>
                  Senaste självskattning: glädje {selfEval.fun_rating}/3 · egen utveckling {selfEval.progress_rating}/3 · laget {selfEval.team_rating}/3
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="card p-8 text-center">
            <p className="font-semibold mb-1">Börja med en utvecklingsavstämning</p>
            <p className="body-small max-w-md mx-auto mb-4" style={{ color: "var(--ink-secondary)" }}>
              Beskriv nuläget, välj högst två fokus och skapa den första historiska ögonblicksbilden för {firstName}.
            </p>
            <Link href={`/spelare/${player.id}/utveckling/avstamning`} className="btn-primary">Gör första avstämningen</Link>
          </div>
        )}
      </section>

      <section id="fardigheter" className="scroll-mt-6 space-y-4">
        <div>
          <p className="eyebrow">Färdigheter</p>
          <h2 className="text-xl font-semibold mt-0.5">Trädet och aktuellt nuläge</h2>
          <p className="body-small mt-1" style={{ color: "var(--ink-secondary)" }}>
            “Aktuellt” visar nästa olåsta steg i varje område. Öppna hela trädet när du behöver mer detalj.
          </p>
        </div>
        <UtvecklingChecklist
          playerId={player.id}
          firstName={firstName}
          initialStatuses={statuses}
          initialNote={note}
          focusSkillIds={focusIds}
        />
      </section>

      <section id="historik" className="scroll-mt-6 space-y-4">
        <div>
          <p className="eyebrow">Avstämningar</p>
          <h2 className="text-xl font-semibold mt-0.5">Utveckling över tid</h2>
        </div>
        {checkpoints.length > 0 ? (
          <div className="space-y-3">
            {checkpoints.map((checkpoint) => {
              const rows = checkpointSkills.get(checkpoint.id) ?? [];
              const changes = rows.filter((item) => item.status !== item.previous_status);
              const focuses = rows.filter((item) => item.is_focus).map((item) => skillById(item.skill_id)).filter(Boolean);
              return (
                <details key={checkpoint.id} className="card p-5" open={checkpoint.id === latest?.id || undefined}>
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-semibold">{checkpoint.date}</h3>
                      <p className="caption mt-0.5" style={{ color: "var(--ink-muted)" }}>
                        {checkpoint.coach_name || "Tränare"} · {checkpoint.changed_count} förändrade steg
                      </p>
                    </div>
                    <span className="badge badge-neutral">{focuses.length} fokus</span>
                  </summary>
                  <div className="mt-4 pt-4 space-y-4" style={{ borderTop: "1px solid var(--border)" }}>
                    {changes.length > 0 ? (
                      <div className="grid sm:grid-cols-2 gap-2">
                        {changes.map((change) => {
                          const skill = skillById(change.skill_id);
                          if (!skill) return null;
                          return (
                            <div key={change.skill_id} className="rounded-lg p-3" style={{ background: "var(--elevated)" }}>
                              <p className="font-medium text-sm">{skill.title}</p>
                              <p className="caption mt-1" style={{ color: "var(--ink-secondary)" }}>
                                {STATUS_LABEL[change.previous_status]} → <strong>{STATUS_LABEL[change.status]}</strong>
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="body-small" style={{ color: "var(--ink-muted)" }}>Nuläget bekräftades utan statusförändringar.</p>
                    )}
                    {checkpoint.strengths && <p className="body-small whitespace-pre-wrap"><strong>Styrkor:</strong> {checkpoint.strengths}</p>}
                    {checkpoint.focus_note && <p className="body-small whitespace-pre-wrap"><strong>Nästa fokus:</strong> {checkpoint.focus_note}</p>}
                    {checkpoint.wellbeing_note && <p className="body-small whitespace-pre-wrap"><strong>Mående:</strong> {checkpoint.wellbeing_note}</p>}
                  </div>
                </details>
              );
            })}
          </div>
        ) : (
          <p className="body-small" style={{ color: "var(--ink-muted)" }}>Ingen avstämningshistorik ännu.</p>
        )}

        {legacyEvaluations.length > 0 && (
          <div className="card p-5" style={{ background: "var(--surface)" }}>
            <p className="font-semibold text-sm">Tidigare utvärderingar · äldre modell</p>
            <p className="body-small mt-1" style={{ color: "var(--ink-secondary)" }}>
              {legacyEvaluations.length} äldre {legacyEvaluations.length === 1 ? "utvärdering är" : "utvärderingar är"} bevarade och kan fortfarande läsas på spelarprofilen. De översätts inte automatiskt till trädstatus.
            </p>
            <Link href={`/spelare/${player.id}#aldre-utvarderingar`} className="caption underline mt-2 inline-block" style={{ color: "var(--primary)" }}>
              Visa äldre utvärderingar
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
