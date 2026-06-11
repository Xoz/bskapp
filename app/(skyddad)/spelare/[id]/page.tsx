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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/spelare" className="text-sm font-medium" style={{ color: "var(--ink-soft)" }}>
            ← Alla spelare
          </Link>
          <h1 className="text-2xl font-bold mt-1">
            {player.jersey_number != null && (
              <span className="mr-2" style={{ color: "var(--ink-soft)" }}>#{player.jersey_number}</span>
            )}
            {player.name}
          </h1>
        </div>
        <Link href={`/spelare/${player.id}/utvardera`} className="btn-primary">
          + Ny utvärdering
        </Link>
      </div>

      {evaluations.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-medium mb-1">Ingen utvärdering ännu</p>
          <p className="text-sm mb-4" style={{ color: "var(--ink-soft)" }}>
            Gör den första utvärderingen för att börja följa {player.name.split(" ")[0]}s utveckling.
          </p>
          <Link href={`/spelare/${player.id}/utvardera`} className="btn-primary">
            Utvärdera nu
          </Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h2 className="font-semibold mb-1">Profil per område</h2>
            <p className="text-xs mb-2" style={{ color: "var(--ink-soft)" }}>
              Senaste utvärderingen {latest.date}
              {previous ? ` jämfört med ${previous.date}` : ""}
            </p>
            <SkillRadar
              data={categoryAverages(latestScores!)}
              compare={previousScores ? categoryAverages(previousScores) : undefined}
            />
          </div>
          <div className="card p-6">
            <h2 className="font-semibold mb-1">Utveckling över tid</h2>
            <p className="text-xs mb-2" style={{ color: "var(--ink-soft)" }}>
              Nivå per område vid varje utvärdering
            </p>
            <DevelopmentChart data={development} />
          </div>
        </div>
      )}

      {latest && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-6">
            <h2 className="font-semibold mb-2">💪 Styrkor</h2>
            <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--ink-soft)" }}>
              {latest.strengths || "Inga noteringar."}
            </p>
          </div>
          <div className="card p-6">
            <h2 className="font-semibold mb-2">🎯 Utvecklingsmål</h2>
            <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--ink-soft)" }}>
              {latest.development_goals || "Inga noteringar."}
            </p>
          </div>
        </div>
      )}

      {evaluations.length > 0 && (
        <div className="card p-6">
          <h2 className="font-semibold mb-4">Alla utvärderingar</h2>
          <div className="space-y-6">
            {evaluations.map((ev) => {
              const scores = getScores(ev.id);
              return (
                <div key={ev.id} className="border-b last:border-b-0 pb-6 last:pb-0" style={{ borderColor: "var(--line)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-medium">
                      {ev.date}
                      {ev.coach_name && (
                        <span className="text-sm font-normal ml-2" style={{ color: "var(--ink-soft)" }}>
                          av {ev.coach_name}
                        </span>
                      )}
                    </p>
                    <form action={deleteEvaluation}>
                      <input type="hidden" name="id" value={ev.id} />
                      <input type="hidden" name="player_id" value={player.id} />
                      <button className="text-xs text-red-500 hover:underline cursor-pointer" type="submit">
                        Ta bort
                      </button>
                    </form>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
                    {CATEGORIES.map((cat) => (
                      <div key={cat.id} className="mb-2">
                        <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: cat.color }}>
                          {cat.name}
                        </p>
                        {cat.skills.map((skill) => {
                          const level = scores[skill.id];
                          if (level == null) return null;
                          return (
                            <div key={skill.id} className="flex items-center justify-between text-sm py-0.5">
                              <span style={{ color: "var(--ink-soft)" }}>{skill.name}</span>
                              <span className="font-medium">
                                {LEVELS.find((l) => l.value === level)?.label}
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

      <div className="card p-6">
        <h2 className="font-semibold mb-4">Redigera spelare</h2>
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
          <div className="flex gap-3">
            <button type="submit" className="btn-primary">Spara</button>
          </div>
        </form>
        <form action={removePlayer} className="mt-4">
          <input type="hidden" name="id" value={player.id} />
          <button
            type="submit"
            className="text-sm text-red-500 hover:underline cursor-pointer"
          >
            Ta bort spelaren från truppen (historiken sparas)
          </button>
        </form>
      </div>
    </div>
  );
}
