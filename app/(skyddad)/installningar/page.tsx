import Link from "next/link";
import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getAllSettings, getSetting } from "@/lib/db";
import { getLatestAttendanceImportSummary, getPlayers } from "@/lib/queries";
import {
  updateSettings,
  updateCoachProfile,
  importCalendarMatches,
  importAttendanceWorkbook,
  generatePlayerPin,
  generateCoachInvite,
  addCoachEmail,
  removeCoachEmail,
  addPlayer,
  addPlayersBulk,
  removePlayer,
  removeDemoPlayers,
  resetColors,
} from "@/lib/actions";
import {
  IconCheck,
  IconAlert,
  IconPitch,
  IconPlayers,
  IconChat,
  IconPlus,
  IconWhistle,
} from "@/components/Icons";
import { headers } from "next/headers";
import SettingsSidebar from "@/components/SettingsSidebar";
import ConfirmForm from "@/components/ConfirmForm";
import { getCoachName, getCoachEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

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
      <text
        x="50"
        y="64"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={38}
        fontWeight="700"
        fontFamily="var(--font-display)"
        fill={ink}
      >
        {label}
      </text>
    </svg>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    sparad?: string;
    kalender?: string;
    narvaro?: string;
    narvaro_spelare?: string;
    narvaro_aktiviteter?: string;
    narvaro_matchade?: string;
  }>;
}) {
  const role = await getRole();
  if (role !== "coach") redirect("/matcher");

  const [inviteToken, inviteExpires, allowedEmails, coachName, coachEmail] = await Promise.all([
    getSetting("coach_invite_token"),
    getSetting("coach_invite_expires"),
    getSetting("allowed_coach_emails"),
    getCoachName(),
    getCoachEmail(),
  ]);
  const coachEmails = allowedEmails
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const inviteValid = !!inviteToken && !!inviteExpires && new Date(inviteExpires) > new Date();
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const inviteUrl = inviteValid ? `${proto}://${host}/invite?token=${inviteToken}` : null;

  const [settings, players, latestAttendanceImport] = await Promise.all([
    getAllSettings(),
    getPlayers(),
    getLatestAttendanceImportSummary(),
  ]);
  const hasDemo = players.some((p) => p.name.startsWith("Exempel:"));
  const { sparad, kalender, narvaro, narvaro_spelare, narvaro_aktiviteter, narvaro_matchade } =
    await searchParams;

  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow">Konfiguration</p>
        <h1 className="text-[32px] font-bold mt-0.5">Inställningar</h1>
        <p className="body-small mt-1" style={{ color: "var(--ink-secondary)" }}>
          Anpassa appen till ditt lag – namn, färger, trupp och åtkomst.
        </p>
      </div>

      {/* Notifieringar */}
      {(sparad || kalender != null) && (
        <div className="mb-6 space-y-2">
          {sparad && (
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm"
              style={{ background: "var(--ok-bg)", color: "var(--success)" }}
            >
              <IconCheck width={16} height={16} />
              Inställningarna är sparade.
            </div>
          )}
          {kalender === "fel" && (
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm"
              style={{ background: "var(--warn-bg)", color: "var(--warning)" }}
            >
              <IconAlert width={16} height={16} />
              Kunde inte hämta kalendern. Kontrollera att länken är rätt och försök igen.
            </div>
          )}
          {kalender === "saknas" && (
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm"
              style={{ background: "var(--warn-bg)", color: "var(--warning)" }}
            >
              <IconAlert width={16} height={16} />
              Spara en kalenderlänk först, sedan kan du hämta matcher.
            </div>
          )}
          {kalender != null && kalender !== "fel" && kalender !== "saknas" && (
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm"
              style={{ background: "var(--ok-bg)", color: "var(--success)" }}
            >
              <IconCheck width={16} height={16} />
              {Number(kalender) === 0
                ? "Kalendern är synkad – inga nya matcher hittades."
                : `${kalender} ${Number(kalender) === 1 ? "ny match hämtades" : "nya matcher hämtades"} från kalendern.`}
            </div>
          )}
          {narvaro === "ok" && (
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm"
              style={{ background: "var(--ok-bg)", color: "var(--success)" }}
            >
              <IconCheck width={16} height={16} />
              {`${narvaro_spelare ?? "0"} spelare och ${narvaro_aktiviteter ?? "0"} tillfällen importerades. ${narvaro_matchade ?? "0"} spelare matchades mot aktiva profiler.`}
            </div>
          )}
          {narvaro === "fil" && (
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm"
              style={{ background: "var(--warn-bg)", color: "var(--warning)" }}
            >
              <IconAlert width={16} height={16} />
              Välj en Excel-fil från Svenska Lag innan du importerar närvaro.
            </div>
          )}
          {narvaro === "fel" && (
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm"
              style={{ background: "var(--warn-bg)", color: "var(--warning)" }}
            >
              <IconAlert width={16} height={16} />
              Kunde inte läsa närvarofilen. Använd exporten &quot;Närvarotillfällen per aktivitet &amp; person&quot; från Svenska Lag.
            </div>
          )}
        </div>
      )}

      <div className="flex gap-10 items-start">
        {/* Sidopanel – sticky, desktop only */}
        <aside className="hidden lg:block w-44 shrink-0 sticky top-20">
          <p
            className="caption uppercase tracking-[0.1em] px-3 mb-2"
            style={{ color: "var(--ink-muted)" }}
          >
            Sektioner
          </p>
          <SettingsSidebar />
        </aside>

        {/* Innehåll */}
        <div className="flex-1 min-w-0 space-y-12 max-w-2xl">

          {/* ── PROFIL ── */}
          <section id="profil" className="space-y-5 scroll-mt-20">
            <div>
              <p className="eyebrow">Profil</p>
            </div>

            <div className="card p-6 md:p-7 space-y-5">
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                >
                  <IconWhistle width={17} height={17} />
                </span>
                <div>
                  <h2 className="font-semibold">Din profil</h2>
                  {coachEmail && (
                    <p className="body-small mt-0.5 font-mono" style={{ color: "var(--ink-muted)" }}>
                      {coachEmail}
                    </p>
                  )}
                </div>
              </div>
              <form action={updateCoachProfile} className="flex gap-2.5 items-end flex-wrap">
                <div className="flex-1 min-w-48">
                  <label className="label" htmlFor="profile_name">Ditt namn</label>
                  <input
                    id="profile_name"
                    name="name"
                    required
                    defaultValue={coachName ?? ""}
                    placeholder="Förnamn Efternamn"
                    className="input"
                  />
                </div>
                <button type="submit" className="btn-primary">Spara namn</button>
              </form>
            </div>
          </section>

          {/* ── MATCHER ── */}
          <section id="matcher" className="space-y-5 scroll-mt-20">
            <div>
              <p className="eyebrow">Matcher</p>
            </div>

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
                  <p className="body-small mt-0.5" style={{ color: "var(--ink-secondary)" }}>
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
              <div className="flex gap-3 flex-wrap">
                <form action={importCalendarMatches}>
                  <button type="submit" className="btn-primary" disabled={!settings.calendar_url}>
                    Hämta matcher nu
                  </button>
                </form>
                <Link href="/matcher/importera-cup" className="btn-secondary">
                  Importera cup från länk
                </Link>
                <Link href="/matcher/ny" className="btn-secondary">
                  <IconPlus width={15} height={15} /> Lägg till match manuellt
                </Link>
              </div>
            </div>
          </section>

          {/* ── LAGET ── */}
          <section id="laget" className="space-y-5 scroll-mt-20">
            <div>
              <p className="eyebrow">Laget</p>
            </div>

            <form action={updateSettings} className="space-y-5">
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
                  <p className="caption mt-1" style={{ color: "var(--ink-muted)" }}>
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
                  <p className="caption mt-1" style={{ color: "var(--ink-muted)" }}>
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
                  <span className="caption" style={{ color: "var(--ink-muted)" }}>Förhandsvisning:</span>
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

              <div className="flex items-center gap-3 flex-wrap">
                <button type="submit" className="btn-primary px-6">Spara laginställningar</button>
                <button
                  type="submit"
                  formAction={resetColors}
                  formNoValidate
                  className="body-small font-semibold underline cursor-pointer"
                  style={{ color: "var(--ink-muted)" }}
                >
                  Återställ färger till standard
                </button>
              </div>
            </form>
          </section>

          {/* ── TRUPP ── */}
          <section id="trupp" className="space-y-5 scroll-mt-20">
            <div>
              <p className="eyebrow">Trupp</p>
            </div>

            {hasDemo && (
              <div
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm flex-wrap"
                style={{
                  background: "var(--warn-bg)",
                  color: "var(--warning)",
                  border: "1px solid color-mix(in srgb, var(--warning), transparent 75%)",
                }}
              >
                <IconAlert width={17} height={17} />
                <span className="flex-1 min-w-48">
                  Truppen innehåller exempelspelare – klistra in din riktiga trupp nedan och rensa sedan exemplen.
                </span>
                <form action={removeDemoPlayers}>
                  <button type="submit" className="font-semibold underline cursor-pointer">
                    Ta bort alla exempelspelare
                  </button>
                </form>
              </div>
            )}

            <div className="card p-6 md:p-7 space-y-5">
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                >
                  <IconPlayers width={17} height={17} />
                </span>
                <div>
                  <h2 className="font-semibold">Lägg till spelare</h2>
                  <p className="body-small mt-0.5" style={{ color: "var(--ink-secondary)" }}>
                    Lägg till spelare en och en, eller klistra in hela truppen från svenskalag.se.
                  </p>
                </div>
              </div>
              <form action={addPlayer} className="flex gap-2 items-end flex-wrap">
                <div>
                  <label className="label" htmlFor="player_name">Namn</label>
                  <input id="player_name" name="name" required className="input w-44" placeholder="Förnamn Efternamn" />
                </div>
                <div>
                  <label className="label" htmlFor="player_jersey_number">Nr</label>
                  <input id="player_jersey_number" name="jersey_number" type="number" min="1" max="99" className="input w-16" />
                </div>
                <button type="submit" className="btn-secondary">
                  <IconPlus width={15} height={15} /> Lägg till
                </button>
              </form>
              <details>
                <summary
                  className="cursor-pointer font-semibold text-sm select-none"
                  style={{ fontFamily: "var(--font-display)", color: "var(--primary)" }}
                >
                  Klistra in hela truppen från svenskalag.se
                </summary>
                <form action={addPlayersBulk} className="mt-4 space-y-3">
                  <p className="body-small" style={{ color: "var(--ink-secondary)" }}>
                    Truppsidan på svenskalag.se kräver inloggning, så kopiera namnlistan därifrån när du är
                    inloggad och klistra in här – ett namn per rad. Tröjnummer före eller efter namnet
                    plockas upp automatiskt (t.ex. &quot;7 Alva Svensson&quot;). Dubbletter hoppas över.
                  </p>
                  <textarea
                    name="names"
                    rows={8}
                    required
                    className="input font-mono text-sm"
                    placeholder={"Alva Svensson\nEbba Karlsson 5\n7 Maja Lindqvist"}
                  />
                  <button type="submit" className="btn-primary">Lägg till spelarna</button>
                </form>
              </details>
            </div>

            <div className="card p-6 md:p-7 space-y-5">
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                >
                  <IconPlayers width={17} height={17} />
                </span>
                <div>
                  <h2 className="font-semibold">Närvaro från Svenska Lag</h2>
                  <p className="body-small mt-0.5" style={{ color: "var(--ink-secondary)" }}>
                    Importera Excel-filen <strong>Närvarotillfällen per aktivitet &amp; person</strong> för att bygga upp trenddata per spelare och månad.
                  </p>
                </div>
              </div>
              {latestAttendanceImport ? (
                <div
                  className="rounded-xl px-4 py-3 text-sm"
                  style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}
                >
                  <p className="font-medium" style={{ color: "var(--ink)" }}>
                    Senaste import: {latestAttendanceImport.file_name || "Excel-fil"}
                  </p>
                  <p className="caption mt-1" style={{ color: "var(--ink-muted)" }}>
                    {latestAttendanceImport.player_count} spelare · {latestAttendanceImport.activity_count} aktiviteter · {latestAttendanceImport.present_count} närvaromarkeringar
                  </p>
                  <p className="caption mt-1" style={{ color: "var(--ink-muted)" }}>
                    {latestAttendanceImport.period_label || "Period okänd"}
                    {latestAttendanceImport.team_name ? ` · ${latestAttendanceImport.team_name}` : ""}
                    {latestAttendanceImport.exported_at ? ` · export ${latestAttendanceImport.exported_at}` : ""}
                  </p>
                </div>
              ) : (
                <p className="body-small" style={{ color: "var(--ink-muted)" }}>
                  Ingen närvarofil importerad ännu.
                </p>
              )}
              <form action={importAttendanceWorkbook} className="space-y-3">
                <div>
                  <label className="label" htmlFor="attendance_file">Excel-fil</label>
                  <input
                    id="attendance_file"
                    name="attendance_file"
                    type="file"
                    accept=".xlsx,.xls"
                    required
                    className="input h-auto cursor-pointer py-3"
                  />
                </div>
                <p className="caption" style={{ color: "var(--ink-muted)" }}>
                  Varje import sparas som ett nytt underlag. Spelarvyn använder alltid den senaste importen för närvarotrenden.
                </p>
                <button type="submit" className="btn-primary">Importera närvaro</button>
              </form>
            </div>

            <div className="card p-6 md:p-7 space-y-5">
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                >
                  <IconPlayers width={17} height={17} />
                </span>
                <div>
                  <h2 className="font-semibold">Spelarprofiler</h2>
                  <p className="body-small mt-0.5" style={{ color: "var(--ink-secondary)" }}>
                    Generera en 6-siffrig PIN per spelare. Spelaren anger sin PIN på <strong>/spelare/login</strong> och får tillgång till sin profil och utveckling.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {players.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl px-4 py-3"
                    style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="body-small font-medium" style={{ color: "var(--ink)" }}>{p.name}</p>
                      {(p as unknown as { pin?: string }).pin ? (
                        <p className="caption mt-0.5 font-mono tracking-widest" style={{ color: "var(--primary)" }}>
                          {(p as unknown as { pin?: string }).pin}
                        </p>
                      ) : (
                        <p className="caption mt-0.5" style={{ color: "var(--ink-muted)" }}>Ingen PIN</p>
                      )}
                    </div>
                    <form action={generatePlayerPin}>
                      <input type="hidden" name="player_id" value={p.id} />
                      <button
                        type="submit"
                        className="caption px-3 py-1.5 rounded-lg transition-colors"
                        style={{ border: "1px solid var(--border)", color: "var(--ink-muted)", background: "transparent" }}
                      >
                        {(p as unknown as { pin?: string }).pin ? "Ny PIN" : "Generera PIN"}
                      </button>
                    </form>
                    <ConfirmForm
                      action={removePlayer}
                      message={`Inaktivera ${p.name}? Spelaren försvinner från den aktiva truppen, men historiken behålls.`}
                    >
                      <input type="hidden" name="id" value={p.id} />
                      <button
                        type="submit"
                        className="caption px-3 py-1.5 rounded-lg transition-colors"
                        style={{ border: "1px solid var(--danger)", color: "var(--danger)", background: "transparent" }}
                      >
                        Inaktivera
                      </button>
                    </ConfirmForm>
                  </div>
                ))}
                {players.length === 0 && (
                  <p className="body-small" style={{ color: "var(--ink-muted)" }}>Inga aktiva spelare.</p>
                )}
              </div>
            </div>
          </section>

          {/* ── TRÄNARE ── */}
          <section id="tranare" className="space-y-5 scroll-mt-20 pb-10">
            <div>
              <p className="eyebrow">Tränare</p>
            </div>

            <div className="card p-6 md:p-7 space-y-5">
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                >
                  <IconChat width={17} height={17} />
                </span>
                <div>
                  <h2 className="font-semibold">Tränarinloggning med Google</h2>
                  <p className="body-small mt-0.5" style={{ color: "var(--ink-secondary)" }}>
                    Lägg till de Gmail-adresser som ska kunna logga in som tränare via Google. Tränaren klickar &ldquo;Logga in med Google&rdquo; på inloggningssidan.
                  </p>
                </div>
              </div>
              {coachEmails.length > 0 ? (
                <div className="space-y-2">
                  {coachEmails.map((email) => (
                    <div
                      key={email}
                      className="flex items-center gap-3 rounded-xl px-4 py-2.5"
                      style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}
                    >
                      <p className="body-small flex-1 font-mono" style={{ color: "var(--ink)" }}>{email}</p>
                      <form action={removeCoachEmail}>
                        <input type="hidden" name="email" value={email} />
                        <button
                          type="submit"
                          className="caption px-2.5 py-1 rounded-lg transition-colors"
                          style={{ border: "1px solid var(--border)", color: "var(--ink-muted)", background: "transparent" }}
                        >
                          Ta bort
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="body-small" style={{ color: "var(--ink-muted)" }}>Inga e-postadresser tillagda.</p>
              )}
              <form action={addCoachEmail} className="flex gap-2.5 items-end flex-wrap">
                <div className="flex-1 min-w-48">
                  <label className="label" htmlFor="coach_email_input">E-postadress</label>
                  <input
                    id="coach_email_input"
                    name="email"
                    type="email"
                    placeholder="traner@gmail.com"
                    className="input"
                  />
                </div>
                <button type="submit" className="btn-secondary">Lägg till</button>
              </form>
            </div>

            <div className="card p-6 md:p-7 space-y-5">
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                >
                  <IconChat width={17} height={17} />
                </span>
                <div>
                  <h2 className="font-semibold">Bjud in tränare</h2>
                  <p className="body-small mt-0.5" style={{ color: "var(--ink-secondary)" }}>
                    Generera en inbjudningslänk (giltig 48 timmar, engångslänk) som ger en ny tränare direkt åtkomst till appen.
                  </p>
                </div>
              </div>
              {inviteUrl ? (
                <div className="space-y-3">
                  <div
                    className="rounded-xl px-4 py-3 text-xs font-mono break-all"
                    style={{ background: "var(--elevated)", border: "1px solid var(--border)", color: "var(--ink-secondary)" }}
                  >
                    {inviteUrl}
                  </div>
                  <p className="caption" style={{ color: "var(--ink-muted)" }}>
                    Giltig till{" "}
                    {new Date(inviteExpires).toLocaleString("sv-SE", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · Engångslänk
                  </p>
                </div>
              ) : null}
              <form action={generateCoachInvite}>
                <button type="submit" className="btn-secondary">
                  {inviteUrl ? "Ny inbjudningslänk" : "Skapa inbjudningslänk"}
                </button>
              </form>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
