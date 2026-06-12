import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getAllSettings } from "@/lib/db";
import { updateSettings } from "@/lib/actions";
import { IconCheck, IconShield } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ sparad?: string }>;
}) {
  const role = await getRole();
  if (role !== "coach") redirect("/matcher");

  const settings = getAllSettings();
  const { sparad } = await searchParams;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <p className="eyebrow">Klubben</p>
        <h1 className="text-[1.7rem] font-bold mt-0.5">Inställningar</h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
          Appen anpassas till vilken klubb som helst – byt namn, färger och koder.
        </p>
      </div>

      {sparad && (
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm"
          style={{ background: "var(--ok-bg)", color: "var(--ok)" }}
        >
          <IconCheck width={16} height={16} />
          Inställningarna är sparade.
        </div>
      )}

      <form action={updateSettings} className="space-y-6">
        <div className="card p-6 md:p-7 space-y-5">
          <h2 className="font-semibold">Klubb och lag</h2>
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="label" htmlFor="club_name">Klubbnamn</label>
              <input id="club_name" name="club_name" defaultValue={settings.club_name} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="team_name">Lagnamn</label>
              <input id="team_name" name="team_name" defaultValue={settings.team_name} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="season">Säsong</label>
              <input id="season" name="season" defaultValue={settings.season} className="input" />
            </div>
          </div>
        </div>

        <div className="card p-6 md:p-7 space-y-5">
          <div>
            <h2 className="font-semibold">Klubbfärger</h2>
            <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
              Primärfärgen bör vara mörk (marinblå, mörkgrön, vinröd) – accentfärgen ljus och varm.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="label" htmlFor="primary_color">Primärfärg</label>
              <input
                id="primary_color"
                name="primary_color"
                type="color"
                defaultValue={settings.primary_color}
                className="input h-12 cursor-pointer"
              />
            </div>
            <div>
              <label className="label" htmlFor="accent_color">Accentfärg</label>
              <input
                id="accent_color"
                name="accent_color"
                type="color"
                defaultValue={settings.accent_color}
                className="input h-12 cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div className="card p-6 md:p-7 space-y-5">
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
            >
              <IconShield width={17} height={17} />
            </span>
            <div>
              <h2 className="font-semibold">Inloggningskoder</h2>
              <p className="text-sm mt-0.5" style={{ color: "var(--ink-soft)" }}>
                Tränarkoden ger full åtkomst. Föräldrakoden ger bara åtkomst till matchstatistiken
                – dela den i föräldragruppen.
              </p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="label" htmlFor="coach_code">Tränarkod</label>
              <input id="coach_code" name="coach_code" defaultValue={settings.coach_code} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="parent_code">Föräldrakod</label>
              <input id="parent_code" name="parent_code" defaultValue={settings.parent_code} className="input" />
            </div>
          </div>
        </div>

        <button type="submit" className="btn-primary px-6">Spara inställningar</button>
      </form>
    </div>
  );
}
