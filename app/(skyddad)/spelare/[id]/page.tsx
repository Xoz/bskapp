import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import {
  getPlayer,
  getEvaluations,
  getScores,
  getPlayerDevelopment,
} from "@/lib/queries";
import { CATEGORIES, LEVELS } from "@/lib/svff";
import { updatePlayer, removePlayer, deleteEvaluation } from "@/lib/actions";
import DevelopmentChart from "@/components/DevelopmentChart";
import SkillRadar from "@/components/SkillRadar";
import Avatar from "@/components/Avatar";
import { IconArrowLeft, IconPlus, IconSpark, IconTarget } from "@/components/Icons";

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
  const player = getPlayer(Number(id));
  if (!player || !player.active) notFound();

  const evaluations = getEvaluations(player.id);
  const development = getPlayerDevelopment(player.id);
  const latest = evaluations[0];
  const previous = evaluations[1];
  const latestScores = latest ? getScores(latest.id) : null;
  const previousScores = previous ? getScores(previous.id) : null;

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
        <Avatar name={player.name} size={64} />
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
              const scores = getScores(ev.id);
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
