import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlayerSession } from "@/lib/auth";
import { getLatestDevelopmentCheckpoint, getPlayer, getPlayerSkillStatuses } from "@/lib/queries";
import { getNextPlanStep, DEVELOPMENT_PLAN_AREAS } from "@/lib/developmentPlan";
import Utvecklingsplan3 from "@/components/Utvecklingsplan3";
import { IconArrowLeft } from "@/components/Icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mitt utvecklingsträd" };

export default async function MittUtvecklingstradPage() {
  const playerId = await getPlayerSession();
  if (!playerId) redirect("/spelare/login");

  const player = await getPlayer(playerId);
  if (!player || !player.active) redirect("/spelare/login");

  const [statuses, latest] = await Promise.all([
    getPlayerSkillStatuses(playerId),
    getLatestDevelopmentCheckpoint(playerId),
  ]);
  const firstName = player.name.split(" ")[0];
  const planFocus = DEVELOPMENT_PLAN_AREAS.map((area) => ({
    area,
    step: getNextPlanStep(area.id, statuses),
  }));

  return (
    <div className="space-y-6 max-w-3xl mx-auto px-5 py-8">
      <Link
        href="/min-profil"
        className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-[var(--primary)]"
        style={{ color: "var(--ink-secondary)", fontFamily: "var(--font-display)" }}
      >
        <IconArrowLeft width={15} height={15} /> Min profil
      </Link>

      <div>
        <p className="eyebrow">Utvecklingsträd · 7v7 → 9v9</p>
        <h1 className="text-[1.5rem] font-bold leading-tight mt-0.5">Hej, {firstName}!</h1>
        <p className="body-small mt-1" style={{ color: "var(--ink-secondary)" }}>
          Det här är vad din tränare ser att du redan klarar, vad du tränar på nu och vad nästa steg är.
        </p>
      </div>

      {latest && (
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="card p-5">
            <p className="eyebrow mb-2">Det här gör du bra</p>
            <p className="body-small whitespace-pre-wrap" style={{ color: "var(--ink-secondary)" }}>
              {latest.strengths || "Din tränare har inte skrivit någon sammanfattning ännu."}
            </p>
          </div>
          <div className="card p-5">
            <p className="eyebrow mb-2">Det här tränar du på nu</p>
            <div className="space-y-1">
              {planFocus.map(({ area, step }) => (
                <p key={area.id} className="caption" style={{ color: step ? "var(--ink-secondary)" : "var(--success)" }}>
                  {area.icon} {area.name}: {step ? step.label : "Klart"}
                </p>
              ))}
            </div>
            <p className="body-small mt-2 whitespace-pre-wrap" style={{ color: "var(--ink-secondary)" }}>
              {latest.focus_note || "Fortsätt träna och våga prova – din tränare fyller på med nästa fokus."}
            </p>
          </div>
        </div>
      )}

      <Utvecklingsplan3 playerId={player.id} initialStatuses={statuses} readOnly />
    </div>
  );
}

