import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getPlayer, getEvaluations, getScores } from "@/lib/queries";
import { CATEGORIES, LEVELS } from "@/lib/svff";
import { createEvaluation } from "@/lib/actions";
import Avatar from "@/components/Avatar";
import AISuggestButton from "@/components/AISuggestButton";
import { IconArrowLeft } from "@/components/Icons";
import { swedishToday } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function EvaluatePage({ params }: { params: Promise<{ id: string }> }) {
  const role = await getRole();
  if (role !== "coach") redirect("/matcher");

  const { id } = await params;
  const player = await getPlayer(Number(id));
  if (!player || !player.active) notFound();

  const latest = (await getEvaluations(player.id))[0];
  const latestScores = latest ? await getScores(latest.id) : {};
  const today = swedishToday();
  const firstName = player.name.replace(/^Exempel:\s*/, "").split(" ")[0];

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href={`/spelare/${player.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-[var(--primary)]"
        style={{ color: "var(--ink-secondary)", fontFamily: "var(--font-display)" }}
      >
        <IconArrowLeft width={15} height={15} /> {player.name}
      </Link>

      <div className="card p-6 md:p-7 flex items-center gap-5">
        <Avatar name={player.name} jersey={player.jersey_number} size={56} />
        <div>
          <p className="eyebrow">Ny utvärdering</p>
          <h1 className="text-[1.5rem] font-bold leading-tight mt-0.5">{player.name}</h1>
          <p className="body-small mt-1" style={{ color: "var(--ink-secondary)" }}>
            Jämför {firstName} med sig själv – inte med andra.
            {latest && " Förra utvärderingen är förifylld."}
          </p>
        </div>
      </div>

      {/* Nivålegend */}
      <div className="card p-5" style={{ background: "var(--primary-ghost)" }}>
        <p className="eyebrow mb-3" style={{ color: "var(--primary)" }}>
          Utvecklingsnivåer – inte betyg
        </p>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2.5">
          {LEVELS.map((l) => (
            <div key={l.value} className="flex items-start gap-3">
              <span className="level-meter mt-1.5 shrink-0">
                {[1, 2, 3, 4].map((i) => (
                  <i key={i} className={i <= l.value ? "on" : ""} />
                ))}
              </span>
              <p className="body-small leading-snug">
                <span className="font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                  {l.label}
                </span>
                <span className="block text-xs mt-0.5" style={{ color: "var(--ink-secondary)" }}>
                  {l.description}
                </span>
              </p>
            </div>
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

        {CATEGORIES.map((cat, idx) => (
          <div key={cat.id} className="card overflow-hidden">
            <div
              className="px-6 py-4 flex items-center gap-3"
              style={{ borderBottom: "1px solid var(--border)", background: `color-mix(in srgb, ${cat.color}, transparent 92%)` }}
            >
              <span
                className="stat-number flex h-7 w-7 items-center justify-center rounded-lg text-xs"
                style={{ background: cat.color, color: "var(--bg)" }}
              >
                {idx + 1}
              </span>
              <h2 className="font-semibold" style={{ color: cat.color }}>
                {cat.name}
              </h2>
            </div>
            <div className="space-y-6 p-6">
              {cat.skills.map((skill) => (
                <div key={skill.id}>
                  <p className="font-medium text-sm">{skill.name}</p>
                  <p className="caption mb-2.5" style={{ color: "var(--ink-muted)" }}>
                    {skill.description}
                  </p>
                  <div className="space-y-1.5">
                    {LEVELS.map((level) => (
                      <label key={level.value}>
                        <input
                          type="radio"
                          name={`skill_${skill.id}`}
                          value={level.value}
                          defaultChecked={latestScores[skill.id] === level.value}
                          className="sr-only"
                        />
                        <span className="level-row">
                          <span
                            className="caption font-semibold uppercase tracking-wide shrink-0"
                            style={{ color: "var(--ink-muted)", minWidth: "5rem" }}
                          >
                            {level.label}
                          </span>
                          <span className="caption" style={{ color: "var(--ink-secondary)" }}>
                            {skill.criteria[level.value]}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="card p-6 space-y-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="font-semibold text-sm">Styrkor & fokusområden</p>
              <p className="caption mt-0.5" style={{ color: "var(--ink-muted)" }}>
                Fyll i nivåerna ovan och tryck AI-förslag för att generera text automatiskt.
              </p>
            </div>
            <AISuggestButton playerId={player.id} />
          </div>
          <div>
            <label className="label" htmlFor="strengths">
              Styrkor – vad är {firstName} bra på?
            </label>
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
            <label className="label" htmlFor="development_goals">
              Utvecklingsmål – vad tränar vi på härnäst?
            </label>
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
          <button type="submit" className="btn-primary px-6">Spara utvärdering</button>
          <Link href={`/spelare/${player.id}`} className="btn-secondary">Avbryt</Link>
        </div>
      </form>
    </div>
  );
}
