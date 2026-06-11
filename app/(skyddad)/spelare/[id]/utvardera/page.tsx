import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getPlayer, getEvaluations, getScores } from "@/lib/queries";
import { CATEGORIES, LEVELS } from "@/lib/svff";
import { createEvaluation } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function EvaluatePage({ params }: { params: Promise<{ id: string }> }) {
  const role = await getRole();
  if (role !== "coach") redirect("/matcher");

  const { id } = await params;
  const player = getPlayer(Number(id));
  if (!player || !player.active) notFound();

  // Förifyll med senaste utvärderingen som utgångspunkt
  const latest = getEvaluations(player.id)[0];
  const latestScores = latest ? getScores(latest.id) : {};
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href={`/spelare/${player.id}`} className="text-sm font-medium" style={{ color: "var(--ink-soft)" }}>
          ← {player.name}
        </Link>
        <h1 className="text-2xl font-bold mt-1">Ny utvärdering</h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
          Enligt SvFF:s spelarutbildningsplan. Jämför spelaren med sig själv – inte med andra.
          {latest && " Förra utvärderingens nivåer är förifyllda."}
        </p>
      </div>

      <div className="card p-4 text-sm" style={{ background: "#eef3ff", borderColor: "#c7d6f5" }}>
        <p className="font-semibold mb-1" style={{ color: "var(--primary)" }}>Nivåerna</p>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
          {LEVELS.map((l) => (
            <p key={l.value} style={{ color: "var(--ink-soft)" }}>
              <span className="font-semibold" style={{ color: "var(--ink)" }}>{l.label}</span> – {l.description}
            </p>
          ))}
        </div>
      </div>

      <form action={createEvaluation} className="space-y-6">
        <input type="hidden" name="player_id" value={player.id} />

        <div className="card p-6 flex gap-4 flex-wrap">
          <div>
            <label className="label" htmlFor="date">Datum</label>
            <input id="date" name="date" type="date" defaultValue={today} required className="input" />
          </div>
          <div className="flex-1 min-w-48">
            <label className="label" htmlFor="coach_name">Tränare</label>
            <input id="coach_name" name="coach_name" className="input" placeholder="Ditt namn" />
          </div>
        </div>

        {CATEGORIES.map((cat) => (
          <div key={cat.id} className="card p-6">
            <h2 className="font-semibold mb-1" style={{ color: cat.color }}>
              {cat.name}
            </h2>
            <div className="space-y-5 mt-4">
              {cat.skills.map((skill) => (
                <div key={skill.id}>
                  <p className="font-medium text-sm">{skill.name}</p>
                  <p className="text-xs mb-2" style={{ color: "var(--ink-soft)" }}>
                    {skill.description}
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {LEVELS.map((level) => (
                      <label key={level.value}>
                        <input
                          type="radio"
                          name={`skill_${skill.id}`}
                          value={level.value}
                          defaultChecked={latestScores[skill.id] === level.value}
                          className="sr-only"
                        />
                        <span className="level-pill">{level.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="card p-6 space-y-4">
          <div>
            <label className="label" htmlFor="strengths">💪 Styrkor – vad är {player.name.split(" ")[0]} bra på?</label>
            <textarea
              id="strengths"
              name="strengths"
              rows={3}
              className="input"
              placeholder="Lyft fram det som spelaren gör bra…"
              defaultValue={latest?.strengths ?? ""}
            />
          </div>
          <div>
            <label className="label" htmlFor="development_goals">🎯 Utvecklingsmål – vad tränar vi på härnäst?</label>
            <textarea
              id="development_goals"
              name="development_goals"
              rows={3}
              className="input"
              placeholder="1–2 konkreta saker att fokusera på…"
              defaultValue={latest?.development_goals ?? ""}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" className="btn-primary">Spara utvärdering</button>
          <Link href={`/spelare/${player.id}`} className="btn-secondary">Avbryt</Link>
        </div>
      </form>
    </div>
  );
}
