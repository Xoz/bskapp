import Link from "next/link";
import { IconArrowLeft } from "@/components/Icons";

export const metadata = { title: "Guide – BSK F2014" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-6 md:p-7 space-y-4">
      <h2 className="font-semibold text-lg" style={{ fontFamily: "var(--font-display)" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span
        className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold"
        style={{ background: "var(--primary)", color: "var(--primary-deep)", fontFamily: "var(--font-display)" }}
      >
        {n}
      </span>
      <div>
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-sm mt-0.5" style={{ color: "var(--ink-soft)" }}>{children}</p>
      </div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm rounded-xl px-4 py-3" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
      💡 {children}
    </p>
  );
}

export default function GuidePage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Rubrik */}
        <div>
          <Link
            href="/rapportera"
            className="inline-flex items-center gap-1.5 text-sm font-medium mb-4 transition-colors hover:text-[var(--primary)]"
            style={{ color: "var(--ink-faint)", fontFamily: "var(--font-display)" }}
          >
            <IconArrowLeft width={14} height={14} /> Tillbaka
          </Link>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
            Guide
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
            Så här använder du BSK F2014-appen – för föräldrar som rapporterar statistik och tränare som hanterar laget.
          </p>
        </div>

        {/* För föräldrar */}
        <div>
          <p className="eyebrow mb-3">För föräldrar</p>

          <Section title="Rapportera statistik under match">
            <Step n={1} title="Öppna rapporteringssidan">
              Klicka på länken tränaren delar i gruppchatten, eller gå till{" "}
              <strong>bskapp.ozmen.app/rapportera</strong> på din mobil. Ingen inloggning krävs.
            </Step>
            <Step n={2} title="Välj matchen">
              Har tränaren skickat en direktlänk hamnar du direkt i matchen. Annars visas dagens matcher som knappar – tryck på rätt match. Saknar du länken och ingen match visas kan du trycka på "Har du en matchkod?" längst ner och skriva in den 6-siffriga koden.
            </Step>
            <Step n={3} title="Ange ditt namn och välj vad du räknar">
              Skriv in ditt namn (t.ex. "Annas mamma") och välj vilken statistik du ansvarar för – t.ex. passningar eller brytningar. Om en annan förälder redan valt något visas det gråat med deras namn – välj något annat.
            </Step>
            <Step n={4} title="Tryck på spelaren när det händer">
              Välj rätt statistikflik (t.ex. Mål) och tryck på spelarens namn varje gång det händer. Varje tryck sparas direkt med matchtid.
            </Step>
            <Step n={5} title="Ångra om du tryckte fel">
              Längst ned syns senaste händelsen med en <em>Ångra</em>-knapp.
            </Step>
            <Tip>
              Dela gärna upp er – en förälder räknar mål och passningar, en annan räknar skott och brytningar. Flera kan rapportera samtidigt utan att det krockar.
            </Tip>
            <Tip>
              Rapporteringen öppnar automatiskt 15 minuter innan avspark. Är du för tidig visas en räknare.
            </Tip>
          </Section>

          <Section title="När matchen är slut">
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
              När tränaren avslutar matchen (eller när appen räknar ut att matchen borde vara klar) stängs rapporteringen automatiskt. Du ser då en sammanställning med slutresultat, all statistik per spelare och ett tidsflöde över matchhändelserna. Matchen visas som <strong>Avslutad</strong> på rapporteringssidan.
            </p>
          </Section>

          <Section title="Bocka av vilka som spelade">
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
              Tryck på fliken <strong>Spelade</strong> och bocka av alla spelare som var med i matchen. Detta används för att hålla koll på att alla får spela lika mycket (SvFF:s riktlinje).
            </p>
          </Section>
        </div>

        {/* För tränare */}
        <div>
          <p className="eyebrow mb-3">För tränare</p>

          <Section title="Logga in">
            <Step n={1} title='Gå till bskapp.ozmen.app och klicka "Till laget"'>
              Ange tränarkoden. Koden kan ändras under Inställningar.
            </Step>
            <Tip>Föräldrar kan logga in med föräldrakoden för att se matcher och statistik.</Tip>
          </Section>

          <Section title="Skapa en match">
            <Step n={1} title="Gå till Matcher → Lägg till match">
              Fyll i datum, motståndare, hemma/borta och matchtyp.
            </Step>
            <Step n={2} title="Ange avsparktid och periodinställningar">
              Avsparktid låser rapporteringen till 15 min innan match. Välj 2 perioder för cup och 3 för seriespel. Standardlängd är 20 min per period.
            </Step>
            <Step n={3} title="Dela direktlänken via WhatsApp">
              På matchsidan visas matchkoden och en <strong>Kopiera länk</strong>-knapp. Kopiera och klistra in länken i gruppchatten – föräldern klickar och hamnar direkt i rapporteringssidan utan att behöva skriva någon kod.
            </Step>
          </Section>

          <Section title="Starta och avsluta match">
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
              I rapporteringsverktyget (den sida föräldrar använder) styr du matchklockan: starta, pausa och byt period. Klicka <strong>Avsluta match</strong> när matchen är klar – rapporteringen stängs för alla och en sammanfattning visas istället. Om du glömmer avslutar appen automatiskt 5 minuter efter att sista periodens tid löpt ut.
            </p>
          </Section>

          <Section title="Komplettera statistik vid videogenomgång">
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
              På varje matchsida finns ett kort <strong>Lägg till händelse</strong> (synligt för tränare). Välj spelare, händelsetyp, period och tid från videon – händelsen sparas i matchflödet och räknas in i totaler och spelarstatistik, precis som live-rapporterade händelser.
            </p>
          </Section>

          <Section title="Nollställa en match">
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
              Gå till matchsidan och klicka <strong>Nollställ match</strong>. Det rensar all statistik, klockan och rapportörerna – matchen finns kvar men börjar om från noll.
            </p>
          </Section>

          <Section title="Statistik och utvärderingar">
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
              Under <strong>Statistik</strong> ser du säsongssammanställning per spelare – deltagande, mål, passningar m.m. Under <strong>Spelare</strong> kan du göra individuella utvärderingar per SvFF:s färdighetsmodell. Appen påminner på startsidan när det gått mer än 60 dagar sedan senaste utvärderingen för en spelare.
            </p>
          </Section>

          <Section title="Koppla kalender från svenskalag.se">
            <Step n={1} title="Gå till Inställningar → Kalender-URL">
              Hämta iCal-länken från ditt lag på svenskalag.se (under Exportera kalender).
            </Step>
            <Step n={2} title="Klistra in länken och klicka Importera">
              Kommande matcher hämtas automatiskt med datum och motståndare.
            </Step>
          </Section>
        </div>

        <p className="text-xs text-center pb-4" style={{ color: "var(--ink-faint)" }}>
          BSK F2014 · Bollstanäs SK · bskapp.ozmen.app
        </p>
      </div>
    </div>
  );
}
