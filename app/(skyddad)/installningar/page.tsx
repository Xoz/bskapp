import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getAllSettings } from "@/lib/db";
import { updateSettings, importCalendarMatches } from "@/lib/actions";
import { IconCheck, IconShield, IconAlert, IconPitch } from "@/components/Icons";

export const dynamic = "force-dynamic";

// Statisk tröjförhandsvisning med valda färger (speglar Avatar-formen)
function JerseyPreview({ fill, ink, label }: { fill: string; ink: string; label: string }) {
  return (
    <svg viewBox="0 0 100 100" width={44} height={44}>
      <path
        d="M28,22 L40,22 L50,31 L60,22 L72,22 L90,34 L80,47 L70,41 L70,84 Q70,86 68,86 L32,86 Q30,86 30,84 L30,41 L20,47 L10,34 Z"
        fill={fill}
        stroke="rgba(0,0,0,0.16)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <text x="50" y="64" textAnchor="middle" dominantBaseline="middle" fontSize={38} fontWeight="700" fontFamily="var(--font-display)" fill={ink}>
        {label}
      </text>
    </svg>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ sparad?: string; kalender?: string }>;
}) {
  const role = await getRole();
  if (role !== "coach") redirect("/matcher");

  const settings = await getAllSettings();
  const { sparad, kalender } = await searchParams;

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

      {kalender === "fel" && (
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm"
          style={{ background: "var(--warn-bg)", color: "var(--warn)" }}
        >
          <IconAlert width={16} height={16} />
          Kunde inte hämta kalendern. Kontrollera att länken är rätt och försök igen.
        </div>
      )}
      {kalender === "saknas" && (
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm"
          style={{ background: "var(--warn-bg)", color: "var(--warn)" }}
        >
          <IconAlert width={16} height={16} />
          Spara en kalenderlänk först, sedan kan du hämta matcher.
        </div>
      )}
      {kalender != null && kalender !== "fel" && kalender !== "saknas" && (
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm"
          style={{ background: "var(--ok-bg)", color: "var(--ok)" }}
        >
          <IconCheck width={16} height={16} />
          {Number(kalender) === 0
            ? "Kalendern är synkad – inga nya matcher hittades."
            : `${kalender} ${Number(kalender) === 1 ? "ny match hämtades" : "nya matcher hämtades"} från kalendern.`}
        </div>
      )}

      {/* Kalenderkoppling */}
      <div className="card p-6 md:p-7 space-y-5">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
          >
            <IconPitch width={17} height={17} />
          </span>
          <div>
            <h2 className="font-semibold">Matchkalender</h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--ink-soft)" }}>
              Klistra in lagets iCal-länk från svenskalag.se (Kalender → Prenumerera/iCal) så
              hämtas matcherna automatiskt. Händelser som innehåller &quot;match&quot;,
              &quot;sammandrag&quot; eller &quot;cup&quot; importeras.
            </p>
          </div>
        </div>
        <form action={updateSettings} className="flex gap-2.5 items-end flex-wrap">
          <div className="flex-1 min-w-64">
            <label className="label" htmlFor="calendar_url">iCal-länk</label>
            <input
              id="calendar_url"
              name="calendar_url"
              type="url"
              defaultValue={settings.calendar_url}
              placeholder="https://www.svenskalag.se/…/calendar.ics"
              className="input"
            />
          </div>
          <button type="submit" className="btn-secondary">Spara länk</button>
        </form>
        <form action={importCalendarMatches}>
          <button type="submit" className="btn-primary" disabled={!settings.calendar_url}>
            Hämta matcher nu
          </button>
        </form>
      </div>

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
          <div>
            <h2 className="font-semibold">Matchtröjor</h2>
            <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
              Spelaravatarerna visas som lagets matchtröja med tröjnumret. Målvakten (nummer 1) får en egen färg.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-5 gap-y-4">
            <div>
              <label className="label" htmlFor="jersey_color">Utespelartröja</label>
              <input id="jersey_color" name="jersey_color" type="color" defaultValue={settings.jersey_color || "#ffd23f"} className="input h-12 cursor-pointer" />
            </div>
            <div>
              <label className="label" htmlFor="jersey_text_color">Siffror utespelare</label>
              <input id="jersey_text_color" name="jersey_text_color" type="color" defaultValue={settings.jersey_text_color || "#111111"} className="input h-12 cursor-pointer" />
            </div>
            <div>
              <label className="label" htmlFor="gk_jersey_color">Målvaktströja (nr 1)</label>
              <input id="gk_jersey_color" name="gk_jersey_color" type="color" defaultValue={settings.gk_jersey_color || "#1f9d57"} className="input h-12 cursor-pointer" />
            </div>
            <div>
              <label className="label" htmlFor="gk_jersey_text_color">Siffror målvakt</label>
              <input id="gk_jersey_text_color" name="gk_jersey_text_color" type="color" defaultValue={settings.gk_jersey_text_color || "#ffffff"} className="input h-12 cursor-pointer" />
            </div>
          </div>
          <div className="flex items-center gap-4 pt-1">
            <span className="text-xs" style={{ color: "var(--ink-faint)" }}>Förhandsvisning:</span>
            <JerseyPreview
              fill={settings.jersey_color || "#ffd23f"}
              ink={settings.jersey_text_color || "#111111"}
              label="7"
            />
            <JerseyPreview
              fill={settings.gk_jersey_color || "#1f9d57"}
              ink={settings.gk_jersey_text_color || "#ffffff"}
              label="1"
            />
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
