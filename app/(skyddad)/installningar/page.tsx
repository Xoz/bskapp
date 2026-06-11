import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getAllSettings } from "@/lib/db";
import { updateSettings } from "@/lib/actions";

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
        <h1 className="text-2xl font-bold">Inställningar</h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
          Appen är byggd för att kunna anpassas till vilken klubb som helst – byt namn, färger och koder.
        </p>
      </div>

      {sparad && (
        <div className="card p-4 text-sm border-green-200 bg-green-50 text-green-800">
          Inställningarna är sparade.
        </div>
      )}

      <form action={updateSettings} className="space-y-6">
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold">Klubb och lag</h2>
          <div className="grid sm:grid-cols-2 gap-4">
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

        <div className="card p-6 space-y-4">
          <h2 className="font-semibold">Klubbfärger</h2>
          <div className="grid sm:grid-cols-2 gap-4">
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

        <div className="card p-6 space-y-4">
          <h2 className="font-semibold">Inloggningskoder</h2>
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            Tränarkoden ger full åtkomst. Föräldrakoden ger bara åtkomst till matchstatistiken –
            dela den i föräldragruppen.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
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

        <button type="submit" className="btn-primary">Spara inställningar</button>
      </form>
    </div>
  );
}
