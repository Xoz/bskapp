import Link from "next/link";
import { IconArrowLeft, IconCheck } from "@/components/Icons";
import { FEATURES } from "@/lib/features";

export const metadata = { title: "Manual – BSK F2014" };

const HIDDEN_CHAPTERS = new Set<string>();
if (!FEATURES.matchStats) HIDDEN_CHAPTERS.add("statistik");
if (!FEATURES.liveScore) HIDDEN_CHAPTERS.add("live");

const CHAPTERS = [
  { id: "kom-igang", number: "01", label: "Kom igång" },
  { id: "oversikt", number: "02", label: "Översikten" },
  { id: "spelare", number: "03", label: "Spelare" },
  { id: "utvarderingar", number: "04", label: "Utvärderingar" },
  { id: "matcher", number: "05", label: "Matcher" },
  { id: "laguttagning", number: "06", label: "Laguttagning" },
  { id: "live", number: "07", label: "Live & rapportering" },
  { id: "cuper", number: "08", label: "Cuper" },
  { id: "statistik", number: "09", label: "Statistik & form" },
  { id: "samtal", number: "10", label: "Samtal & spelarvy" },
  { id: "administration", number: "11", label: "Administration" },
  { id: "installningar", number: "12", label: "Inställningar" },
  { id: "arbetsfloden", number: "13", label: "Arbetsflöden" },
  { id: "felsokning", number: "14", label: "Felsökning" },
] as const;

const VISIBLE_CHAPTERS = CHAPTERS.filter((c) => !HIDDEN_CHAPTERS.has(c.id));

function Toc({ compact = false }: { compact?: boolean }) {
  return (
    <nav aria-label="Manualens innehåll" className={compact ? "grid sm:grid-cols-2 gap-x-4" : "space-y-0.5"}>
      {VISIBLE_CHAPTERS.map((chapter) => (
        <a
          key={chapter.id}
          href={`#${chapter.id}`}
          className="group flex items-center gap-3 py-2 text-sm transition-colors hover:text-[var(--primary)]"
          style={{ color: "var(--ink-secondary)" }}
        >
          <span
            className="caption tabular-nums transition-colors group-hover:text-[var(--primary)]"
            style={{ color: "var(--ink-muted)", fontFamily: "var(--font-display)" }}
          >
            {chapter.number}
          </span>
          <span>{chapter.label}</span>
        </a>
      ))}
    </nav>
  );
}

function Chapter({
  id,
  number,
  title,
  intro,
  children,
}: {
  id: string;
  number: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t pt-10 md:pt-14" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-baseline gap-3 mb-3">
        <span className="caption" style={{ color: "var(--primary)", fontFamily: "var(--font-display)" }}>
          {number}
        </span>
        <h2 className="text-2xl md:text-[1.75rem] font-bold">{title}</h2>
      </div>
      <p className="text-[0.95rem] leading-7 mb-8 max-w-2xl" style={{ color: "var(--ink-secondary)" }}>
        {intro}
      </p>
      <div className="space-y-9">{children}</div>
      <a
        href="#manual-top"
        className="inline-flex mt-10 text-xs transition-colors hover:text-[var(--primary)]"
        style={{ color: "var(--ink-muted)" }}
      >
        Till innehållet ↑
      </a>
    </section>
  );
}

function Topic({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[18px] font-semibold mb-3">{title}</h3>
      <div className="space-y-3 text-sm leading-6" style={{ color: "var(--ink-secondary)" }}>
        {children}
      </div>
    </div>
  );
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="space-y-3 counter-reset-manual">{children}</ol>;
}

function Step({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full caption font-bold"
        style={{ background: "var(--primary-soft)", color: "var(--primary)", fontFamily: "var(--font-display)" }}
      >
        <IconCheck width={12} height={12} strokeWidth={2.5} />
      </span>
      <div>
        <p className="font-semibold" style={{ color: "var(--ink)" }}>{title}</p>
        {children && <div className="mt-0.5">{children}</div>}
      </div>
    </li>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-2 pl-1">{children}</ul>;
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-[0.65rem] h-1 w-1 shrink-0 rounded-full" style={{ background: "var(--primary)" }} />
      <span>{children}</span>
    </li>
  );
}

function Callout({ title, children, tone = "tip" }: { title: string; children: React.ReactNode; tone?: "tip" | "note" | "warn" }) {
  const colors = tone === "warn"
    ? { background: "var(--warn-bg)", border: "color-mix(in srgb, var(--warning), transparent 70%)", color: "var(--warning)" }
    : tone === "note"
      ? { background: "var(--surface)", border: "var(--border)", color: "var(--ink)" }
      : { background: "var(--primary-ghost)", border: "var(--primary-line)", color: "var(--primary)" };
  return (
    <aside className="border-l-2 px-4 py-3.5" style={{ background: colors.background, borderColor: colors.border }}>
      <p className="caption font-semibold uppercase tracking-wider mb-1.5" style={{ color: colors.color }}>{title}</p>
      <div className="body-small leading-6" style={{ color: "var(--ink-secondary)" }}>{children}</div>
    </aside>
  );
}

function Term({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="grid sm:grid-cols-[150px_1fr] gap-1 sm:gap-5 py-3 border-t" style={{ borderColor: "var(--border)" }}>
      <dt className="font-semibold text-sm" style={{ color: "var(--ink)" }}>{name}</dt>
      <dd className="body-small leading-6" style={{ color: "var(--ink-secondary)" }}>{children}</dd>
    </div>
  );
}

export default function GuidePage() {
  return (
    <main id="manual-top" className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-7 md:py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium mb-7 transition-colors hover:text-[var(--primary)]"
          style={{ color: "var(--ink-muted)", fontFamily: "var(--font-display)" }}
        >
          <IconArrowLeft width={14} height={14} /> Tillbaka till appen
        </Link>

        <header className="pb-8 md:pb-12">
          <p className="eyebrow mb-3">BSK F2014 · Hjälpcenter</p>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">Manual</h1>
          <p className="mt-4 max-w-2xl text-base md:text-lg leading-7" style={{ color: "var(--ink-secondary)" }}>
            En komplett guide till laget, spelarna, matcherna och uppföljningen. Börja med Kom igång
            om du är ny, eller använd innehållet för att gå direkt till en funktion.
          </p>
        </header>

        <details className="lg:hidden card mb-8 group">
          <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-5 py-4 font-semibold">
            Innehåll
            <span className="text-lg group-open:rotate-45 transition-transform" style={{ color: "var(--primary)" }}>+</span>
          </summary>
          <div className="px-5 pb-5 border-t pt-2" style={{ borderColor: "var(--border)" }}>
            <Toc compact />
          </div>
        </details>

        <div className="grid lg:grid-cols-[220px_minmax(0,1fr)] gap-10 xl:gap-16 items-start">
          <aside className="hidden lg:block sticky top-20">
            <p className="eyebrow mb-3">Innehåll</p>
            <Toc />
          </aside>

          <article className="min-w-0 space-y-14 md:space-y-20 pb-24">
            <Chapter
              id="kom-igang"
              number="01"
              title="Kom igång"
              intro="Det här avsnittet är för dig som öppnar appen för första gången. Åtkomsten styrs av din roll, så två personer kan se olika menyer trots att de använder samma app."
            >
              <Topic title="Logga in som tränare eller ledare">
                <Steps>
                  <Step title="Öppna appens startsida och välj Tränare" />
                  <Step title="Välj Logga in med Google">Använd den Google-adress som administratören har registrerat för dig.</Step>
                  <Step title="Godkänn inloggningen">Efter en lyckad inloggning kommer personal normalt till Översikten.</Step>
                </Steps>
                <Callout title="Om du inte blir godkänd" tone="warn">
                  Kontrollera att du använder rätt Google-konto. En administratör kan lägga till adressen under
                  Administration eller skicka en inbjudningslänk. En vanlig Gmail-inloggning ger inte åtkomst av sig själv.
                </Callout>
              </Topic>

              <Topic title="Så fungerar navigeringen">
                <p><strong style={{ color: "var(--ink)" }}>På dator</strong> ligger huvudmenyn överst: Översikt, Spelare, Matcher, Statistik, Administration och Guide. Vilka länkar du ser beror på behörighet.</p>
                <p><strong style={{ color: "var(--ink)" }}>På mobil</strong> ligger de viktigaste delarna i menyn längst ned. Inställningar öppnas via kugghjulet högst upp.</p>
                <p>Klubbmärket tar dig tillbaka till din startsida. Månikonen byter mellan ljust och mörkt läge. Utloggningsikonen avslutar sessionen.</p>
              </Topic>

              <Topic title="Roller i korthet">
                <dl>
                  <Term name="Admin">Full åtkomst till organisation, inställningar och sportsliga funktioner.</Term>
                  <Term name="Huvudtränare">Bred sportslig åtkomst och möjlighet att hantera användare och grupper.</Term>
                  <Term name="Tränare">Arbetar med spelare, utvärderingar, matcher, laguttagningar och statistik.</Term>
                  <Term name="Ledare">Ser grundläggande laginformation och kan hjälpa till med matcher och rapportering enligt tilldelad åtkomst.</Term>
                  <Term name="Spelare">Ser sin egen kopplade profil.</Term>
                  <Term name="Förälder">Ser de barn som administratören har kopplat till kontot.</Term>
                </dl>
                <Callout title="Flera roller är tillåtna" tone="note">
                  En person kan exempelvis vara både ledare och förälder. Administratören kan även tillåta eller neka
                  enstaka funktioner och begränsa en person till vissa lag.
                </Callout>
              </Topic>

              <Topic title="Rekommenderad första konfiguration">
                <Steps>
                  <Step title="Kontrollera klubb, lag och säsong">Görs under Inställningar → Laget.</Step>
                  <Step title="Lägg in truppen">Lägg till namn, tröjnummer och undergrupp. Position och spelnivå kan kompletteras senare.</Step>
                  <Step title="Koppla matchkalendern">Importera kalendern under Inställningar → Matcher eller skapa matcher manuellt.</Step>
                  <Step title="Bjud in tränarstaben">Registrera Google-adresser under Administration och kontrollera rollerna.</Step>
                  <Step title="Öppna en kommande match">Sätt matchnivå och ta ut truppen när underlaget är klart.</Step>
                </Steps>
              </Topic>
            </Chapter>

            <Chapter
              id="oversikt"
              number="02"
              title="Översikten"
              intro="Översikten samlar det som är viktigast just nu. Den är en arbetsyta för tränarstaben, inte bara en resultatsida."
            >
              <Topic title="Säsongskortet">
                <List>
                  <Item><strong style={{ color: "var(--ink)" }}>Spelade</strong> är antalet avslutade eller resultatförda matcher.</Item>
                  <Item><strong style={{ color: "var(--ink)" }}>V–O–F</strong> betyder vinster, oavgjorda och förluster.</Item>
                  <Item><strong style={{ color: "var(--ink)" }}>Mål</strong> visar gjorda och insläppta mål.</Item>
                  <Item><strong style={{ color: "var(--ink)" }}>Trupp</strong> visar antalet aktiva spelare.</Item>
                </List>
                <p>Den stora åtgärdsknappen anpassas efter läget. Den kan till exempel föreslå laguttagning, rapportering av dagens match eller registrering av nästa steg.</p>
              </Topic>

              <Topic title="Kommande matcher">
                <p>De närmaste matcherna visas med datum, tid, hemma/borta och motståndare. Om en match saknar uttagen trupp markeras den med <strong style={{ color: "var(--ink)" }}>Trupp saknas</strong>.</p>
                <p>När du öppnar en match från Översikten kommer du direkt till laguttagningen, eftersom det oftast är nästa praktiska steg inför match.</p>
              </Topic>

              <Topic title="Senaste matchen och Form just nu">
                <p>Senaste matchen visar resultat, motståndare och eventuella målskyttar. Formpanelen bygger på tränarnas matchbetyg, inte enbart på mål och assist.</p>
                <p><strong style={{ color: "var(--ink)" }}>På uppgång</strong> och <strong style={{ color: "var(--ink)" }}>Tappat senast</strong> beskriver förändring i spelarens matchform. Det ska användas som samtals- och observationsstöd, inte som en offentlig ranking.</p>
              </Topic>

              <Topic title="Att göra och Senaste aktivitet">
                <p>Att göra-listan samlar konkreta luckor, exempelvis en kommande match utan trupp, ett resultat som saknas eller en spelare som behöver följas upp.</p>
                <p>Aktivitetsloggen visar vad tränarstaben nyligen har gjort. Den är användbar när flera ledare delar ansvaret och minskar risken för dubbelarbete.</p>
              </Topic>
            </Chapter>

            <Chapter
              id="spelare"
              number="03"
              title="Spelare"
              intro="Spelarsidan är både truppregister och ingång till varje spelares utveckling, matcher, statistik och samtal."
            >
              <Topic title="Lägga till en spelare">
                <Steps>
                  <Step title="Gå till Spelare eller Inställningar → Trupp" />
                  <Step title="Fyll i namn och tröjnummer">Tröjnumret kan ändras senare.</Step>
                  <Step title="Välj undergrupp">Det styr vilket lag spelaren normalt tillhör. En spelare kan senare vara medlem i flera grupper.</Step>
                  <Step title="Spara och öppna spelarprofilen">Komplettera position, spelnivå och interna anteckningar där.</Step>
                </Steps>
              </Topic>

              <Topic title="Spelarlistan">
                <p>Överst visas ledare inom mål, assist och passningar när statistik finns. Tabellen visar sedan truppen och säsongssiffror. På små skärmar döljs vissa detaljkolumner, men informationen finns kvar på spelarprofilen.</p>
                <p>Klicka på en spelare för att se profil, utvärderingar, form, samtal och matchstatistik. Användare utan rätt att se privat spelarunderlag får en mer begränsad vy.</p>
              </Topic>

              <Topic title="Redigera en spelare">
                <dl>
                  <Term name="Position">Spelarens vanligaste utgångsposition. Den används som stöd i laguttagningen.</Term>
                  <Term name="Spelnivå">Tränarens aktuella planeringsnivå. Den jämförs med matchens nivå för att sortera och färgmarkera spelare.</Term>
                  <Term name="Anteckningar">Intern information som bara ska vara tillgänglig för behörig personal.</Term>
                  <Term name="Aktiv status">Avaktivera en spelare som lämnat truppen utan att radera historiken.</Term>
                </dl>
                <Callout title="Spelnivå är ett planeringsstöd">
                  Nivån ska inte presenteras för barnen som ett värde på spelaren. Den kan ändras över tid och ska kombineras med
                  speltid, trygghet, position, träningsmål och gruppens behov.
                </Callout>
              </Topic>

              <Topic title="Spelarprofilens delar">
                <List>
                  <Item><strong style={{ color: "var(--ink)" }}>Självskattning</strong> visar hur spelaren själv upplever glädje, utveckling och laget.</Item>
                  <Item><strong style={{ color: "var(--ink)" }}>Utvecklingsdiagram</strong> sammanfattar tränarnas utvärderingar över tid.</Item>
                  <Item><strong style={{ color: "var(--ink)" }}>Matchform</strong> visar förändring baserad på matchbetyg.</Item>
                  <Item><strong style={{ color: "var(--ink)" }}>Styrkor och utvecklingsmål</strong> kommer från senaste utvärderingen.</Item>
                  <Item><strong style={{ color: "var(--ink)" }}>Samtal</strong> visar genomförda spelarintervjuer.</Item>
                  <Item><strong style={{ color: "var(--ink)" }}>Matchstatistik</strong> visar både summering och match-för-match.</Item>
                </List>
              </Topic>

              <Topic title="Delbar spelarlänk">
                <p>En tränare kan skapa en tidsbegränsad länk till spelarens kort. Kopiera länken och dela den endast med avsedd mottagare. Återkalla länken när den inte längre behövs.</p>
                <Callout title="Tänk på integriteten" tone="warn">
                  En delningslänk fungerar utan vanlig tränarinloggning. Skicka den inte i öppna grupper och skapa en ny om du misstänker att den spridits vidare.
                </Callout>
              </Topic>
            </Chapter>

            <Chapter
              id="utvarderingar"
              number="04"
              title="Spelarutveckling"
              intro="Utvecklingssidan samlar nuläge, färdighetsträd och daterade avstämningar. Spelaren ska jämföras med sig själv, inte med lagkamraterna."
            >
              <Topic title="Färdighetssteg – inte skolbetyg">
                <p>Varje konkret färdighetssteg markeras som ej påbörjat, tränar på, nästan klart eller klart. Svårighetsnivå 1–5 beskriver själva steget; statusen beskriver var spelaren befinner sig just nu.</p>
                <Callout title="Bra bedömningsprincip">
                  Bedöm det spelaren visar återkommande i relevanta situationer. Ett enskilt lyckat eller misslyckat moment bör normalt inte flytta en nivå.
                </Callout>
              </Topic>

              <Topic title="Gör en utvecklingsavstämning">
                <Steps>
                  <Step title="Öppna spelaren och välj Öppna utveckling" />
                  <Step title="Välj Ny avstämning" />
                  <Step title="Kontrollera datum och tränarnamn" />
                  <Step title="Uppdatera observerade färdigheter">Kategorierna är hopfällda. Ändra bara det du faktiskt har sett sedan förra avstämningen.</Step>
                  <Step title="Skriv styrkor">Lyft fram konkreta beteenden som spelaren kan känna igen.</Step>
                  <Step title="Välj högst två fokusfärdigheter">Beskriv hur laget och spelaren ska träna på dem.</Step>
                  <Step title="Notera mående separat">Glädje, trygghet och lagkänsla är viktiga signaler men räknas inte som färdigheter som ska bli klara.</Step>
                  <Step title="Spara avstämningen">Nuläget uppdateras och en historisk ögonblicksbild skapas.</Step>
                </Steps>
              </Topic>

              <Topic title="Historik och äldre utvärderingar">
                <p>Avstämningshistoriken visar vilka färdigheter som ändrades, valda fokus och tränarens sammanfattning. Äldre fyrgradiga SvFF-utvärderingar finns kvar på spelarprofilen men ändrar inte automatiskt det nya trädet.</p>
              </Topic>

              <Topic title="Jämför tränarens och spelarens bild">
                <p>Självskattningen kan visa att spelaren upplever situationen annorlunda än tränaren. Skillnaden är inte ett fel som ska rättas, utan ett bra underlag för samtal. Fråga öppet och låt spelaren beskriva sin upplevelse.</p>
              </Topic>
            </Chapter>

            <Chapter
              id="matcher"
              number="05"
              title="Matcher"
              intro="Matchområdet samlar vanliga matcher och cuper. Här förbereder ni truppen, rapporterar händelser och följer upp resultat, statistik och form."
            >
              <Topic title="Tre sätt att få in matcher">
                <dl>
                  <Term name="Matchkalender">Koppla lagets iCal-kalender under Inställningar för återkommande import.</Term>
                  <Term name="Manuell match">Använd när en enstaka match inte finns i kalendern.</Term>
                  <Term name="Cupimport">Klistra in cupens iCal-länk för att hämta flera matcher och cupinformation på en gång.</Term>
                </dl>
              </Topic>

              <Topic title="Skapa en match manuellt">
                <Steps>
                  <Step title="Öppna Matcher och välj att lägga till match" />
                  <Step title="Ange datum, tid och motståndare" />
                  <Step title="Välj hemma eller borta och matchtyp" />
                  <Step title="Ange plats om den är känd" />
                  <Step title="Sätt svårighetsnivå">Nivån används i laguttagningen och kan ändras senare.</Step>
                  <Step title="Spara och öppna matchsidan" />
                </Steps>
              </Topic>

              <Topic title="Matchsidans funktioner">
                <List>
                  <Item><strong style={{ color: "var(--ink)" }}>Laguttagning</strong> väljer matchtrupp, startuppställning och formation.</Item>
                  <Item><strong style={{ color: "var(--ink)" }}>Liverapportering</strong> öppnar tränarens matchverktyg.</Item>
                  <Item><strong style={{ color: "var(--ink)" }}>Föräldrarapportering</strong> kan öppnas eller stängas och har en separat delningslänk.</Item>
                  <Item><strong style={{ color: "var(--ink)" }}>Livescore</strong> är den publika följvyn.</Item>
                  <Item><strong style={{ color: "var(--ink)" }}>Matchbetyg</strong> används efter matchen för att uppdatera spelarnas form.</Item>
                  <Item><strong style={{ color: "var(--ink)" }}>Rätta statistik</strong> ändrar registrerade siffror i efterhand.</Item>
                </List>
              </Topic>

              <Topic title="Resultat, händelser och rättningar">
                <p>Resultatet är frivilligt i barnfotbollen. Statistik och matchhändelser kan rapporteras live eller läggas till i efterhand. Om en enskild siffra blev fel ska du använda rättningsfunktionen.</p>
                <Callout title="Nollställning tar bort mycket" tone="warn">
                  Nollställ matchen endast när hela rapporteringen behöver börja om. Funktionen rensar statistik och klocka. För enstaka fel är rättning eller borttagning av händelse säkrare.
                </Callout>
              </Topic>
            </Chapter>

            <Chapter
              id="laguttagning"
              number="06"
              title="Laguttagning"
              intro="Laguttagningen hjälper tränaren att kombinera matchnivå, positioner och gruppens behov. Systemets färger och sortering är stöd för beslutet – inte beslutet självt."
            >
              <Topic title="Ta ut en matchtrupp">
                <Steps>
                  <Step title="Kontrollera matchens nivå">Om nivån saknas, gå tillbaka till matchen eller cupinställningarna och sätt den.</Step>
                  <Step title="Välj spelare i trupplistan">Spelarna sorteras efter hur deras satta nivå passar matchnivån.</Step>
                  <Step title="Välj formation" />
                  <Step title="Dra spelare till planen">Placera startspelarna på avsedda positioner.</Step>
                  <Step title="Kontrollera bänk och fördelning">Ta hänsyn till speltid, frånvaro, belastning och tidigare uttagningar.</Step>
                  <Step title="Spara trupp och uppställning" />
                </Steps>
              </Topic>

              <Topic title="Så ska färgmatchningen tolkas">
                <p>Färgen visar hur spelarens planeringsnivå förhåller sig till matchens svårighetsnivå. Den säger inte att spelaren är lämplig eller olämplig i alla avseenden.</p>
                <Callout title="Tränaren har alltid helhetsansvaret">
                  Variera utmaningen över tid och prioritera jämn delaktighet. Position, relationer i gruppen, självförtroende,
                  träningsnärvaro och utvecklingsmål kan väga tyngre än nivåmatchningen.
                </Callout>
              </Topic>

              <Topic title="Cuptrupp och matchtrupp">
                <p>En cup kan ha en gemensam uttagen trupp. Den används som förval när du öppnar laguttagningen för en enskild cupmatch. Du kan därefter anpassa varje matchtrupp utan att ändra cupens grundtrupp.</p>
              </Topic>
            </Chapter>

            {FEATURES.liveScore && (
            <Chapter
              id="live"
              number="07"
              title="Live och rapportering"
              intro="Under matchen kan tränare och utsedda rapportörer registrera händelser. Alla andra kan följa matchen via Livescore utan att kunna ändra något."
            >
              <Topic title="Före avspark">
                <Steps>
                  <Step title="Kontrollera matchtruppen">Rätt spelare måste finnas med för att statistiken ska hamna rätt.</Step>
                  <Step title="Öppna liverapporteringen från matchsidan" />
                  <Step title="Kontrollera periodlängd och matchklocka" />
                  <Step title="Dela rätt länk">Livescore är för följare. Rapportera-länken är bara för personer som ska registrera händelser.</Step>
                </Steps>
              </Topic>

              <Topic title="Under matchen">
                <p>Starta klockan vid avspark. Registrera mål, assist, skott, passningar, brytningar och andra tillgängliga händelser på rätt spelare. Byten och deltagande kan också följas.</p>
                <p>Om du trycker fel, använd ångra så snart som möjligt. Varje rapportör kan bara ångra sina egna senaste händelser.</p>
              </Topic>

              <Topic title="Föräldrarapportering">
                <p>Rapporteringen öppnas automatiskt 60 minuter före avspark, eller kan öppnas manuellt tidigare. En rapportör går in via den särskilda länken och behöver inte ha ett tränarkonto.</p>
                <Callout title="Dela länkar med rätt målgrupp" tone="warn">
                  Livescore-länken kan spridas brett. Rapportera-länken bör bara skickas till betrodda personer eftersom den ger möjlighet att ändra matchflödet.
                </Callout>
              </Topic>

              <Topic title="Avsluta och kontrollera">
                <Steps>
                  <Step title="Stoppa klockan efter sista perioden" />
                  <Step title="Markera matchen som avslutad" />
                  <Step title="Kontrollera resultat och händelseflöde" />
                  <Step title="Rätta eventuella fel på matchsidan" />
                  <Step title="Sätt matchbetyg när tränarstaben har underlag" />
                </Steps>
              </Topic>
            </Chapter>
            )}

            <Chapter
              id="cuper"
              number="08"
              title="Cuper"
              intro="Cupfunktionen håller ihop flera matcher, gemensam trupp, gruppspel och slutspel. En cup kan skapas manuellt eller importeras från en iCal-länk."
            >
              <Topic title="Importera en cup">
                <Steps>
                  <Step title="Öppna Matcher → Importera cup" />
                  <Step title="Klistra in cupens iCal-länk">Länken kommer normalt från cupsidan eller Profixio/Rubic.</Step>
                  <Step title="Hämta en förhandsvisning">Kontrollera cupnamn, lag och matcher innan något sparas.</Step>
                  <Step title="Välj svårighetsnivå" />
                  <Step title="Importera matcherna">Öppna därefter cupkortet på Matchersidan.</Step>
                </Steps>
              </Topic>

              <Topic title="Skapa cupen manuellt">
                <p>Använd Ny cup när kalenderlänk saknas. Fyll i cupnamn, nivå och gruppspelsmatcher. Motstånd, plats, datum och avsparktid kan redigeras senare.</p>
              </Topic>

              <Topic title="Cupens delar">
                <dl>
                  <Term name="Cupinställningar">Namn, nivå och eventuell gruppinformation som gäller cupen.</Term>
                  <Term name="Gruppspel">De inledande matcherna. Resultat kan sammanställas som poäng och målskillnad.</Term>
                  <Term name="Slutspel">Kvartsfinal, semifinal, final eller placeringsmatch läggs till när motstånd och tider blir kända.</Term>
                  <Term name="Cuptrupp">Den gemensamma spelargrupp som är uttagen till turneringen.</Term>
                  <Term name="Matchgrupp">En intern grupp som håller isär rätt spelare och matcher när organisationen har flera lag.</Term>
                </dl>
              </Topic>

              <Topic title="Under cupdagen">
                <p>Öppna cupen för att se alla matcher i ordning. Anpassa laguttagningen per match, rapportera matcherna som vanligt och lägg till slutspel när lottningen är klar. Cupkortet kan därefter visa placering, målskyttar och form inom cupen.</p>
                <Callout title="Var försiktig med preliminära slutspelsmatcher" tone="note">
                  Motståndare och tider kan ändras snabbt. Kontrollera cupsidan innan ni delar informationen eller låser en uppställning.
                </Callout>
              </Topic>
            </Chapter>

            {FEATURES.matchStats && (
            <Chapter
              id="statistik"
              number="09"
              title="Statistik och form"
              intro="Statistiken sammanfattar det som registrerats i matcherna. Tom eller ofullständig rapportering påverkar därför alla tabeller och trender."
            >
              <Topic title="Lagets nyckeltal">
                <List>
                  <Item><strong style={{ color: "var(--ink)" }}>Matcher</strong> är antalet spelade matcher.</Item>
                  <Item><strong style={{ color: "var(--ink)" }}>V–O–F</strong> summerar resultatförda matcher.</Item>
                  <Item><strong style={{ color: "var(--ink)" }}>Mål gjorda och insläppta</strong> visas både totalt och som snitt.</Item>
                  <Item><strong style={{ color: "var(--ink)" }}>Målskillnad</strong> är gjorda mål minus insläppta mål.</Item>
                  <Item><strong style={{ color: "var(--ink)" }}>3m och 6m</strong> är snitt för de senaste tre respektive sex statistikförda matcherna.</Item>
                </List>
                <p>En pil visar förändring mellan perioderna. För mått där ett lägre värde är bättre, exempelvis insläppta mål, anpassas bedömningen efter det.</p>
              </Topic>

              <Topic title="Match för match">
                <p>Tabellen gör det möjligt att jämföra lagets statistik mellan matcher. Förkortningarna förklaras ovanför eller via kolumnens titel på dator. Öppna matchen om en siffra behöver rättas.</p>
              </Topic>

              <Topic title="Statistik per spelare">
                <p>Säsongstabellen summerar varje spelares deltagande och registrerade händelser. En spelare kan vara markerad som deltagare även om ingen individuell statistik registrerades.</p>
                <Callout title="Noll betyder inte alltid att inget hände" tone="note">
                  Kontrollera om matchen faktiskt statistikfördes. En tom rapporterad match och en korrekt registrerad nolla kan se lika ut i en totalsumma.
                </Callout>
              </Topic>

              <Topic title="Matchbetyg och form">
                <p>Efter matchen bedömer tränaren hur spelaren presterade i förhållande till förväntan. Systemet räknar sedan en löpande formkurva. Ett bra utfall mot tufft motstånd kan väga annorlunda än samma utfall i en lättare match.</p>
                <p>Formen kan ge ett förslag om att se över spelarens satta nivå. Tränaren måste aktivt bekräfta en nivåändring; appen flyttar inte spelaren automatiskt.</p>
                <Callout title="Form är färskvara">
                  Använd kurvan för att upptäcka mönster och ställa frågor. Undvik att rangordna barn offentligt eller fatta beslut från en enda match.
                </Callout>
              </Topic>
            </Chapter>
            )}

            <Chapter
              id="samtal"
              number="10"
              title="Samtal och spelarens egen vy"
              intro="Spelaren och föräldern har begränsade vyer som är separerade från tränarens arbetsyta. Samtal och självskattning ska ge barnet en tydligare röst i uppföljningen."
            >
              <Topic title="Spelarens PIN-inloggning">
                <Steps>
                  <Step title="Generera PIN under Inställningar → Spelarprofiler" />
                  <Step title="Ge koden direkt till spelaren eller vårdnadshavaren" />
                  <Step title="Spelaren loggar in på spelarens inloggningssida" />
                  <Step title="Byt PIN om koden har spridits" />
                </Steps>
              </Topic>

              <Topic title="Självskattning">
                <p>Spelaren kan svara på hur rolig fotbollen känns, hur utvecklingen upplevs och hur det känns i laget. Det finns även fritext för vad spelaren är bra på, vill förbättra och vill berätta för tränaren.</p>
                <Callout title="Följ upp signaler" tone="warn">
                  Om en spelare beskriver låg trygghet eller trivsel ska en ansvarig vuxen följa upp det på ett varsamt sätt. Appen ersätter inte ett samtal.
                </Callout>
              </Topic>

              <Topic title="AI-intervju">
                <p>Spelaren väljer en intervjutyp och genomför ett guidat samtal i chatten. När samtalet avslutas sparas det så att behöriga tränare kan läsa det under Spelare → Samtal och på spelarprofilen.</p>
                <p>Berätta för spelaren vem som kan läsa svaren och varför samtalet görs. Tränaren ansvarar för uppföljningen även när frågorna ställs av AI.</p>
              </Topic>

              <Topic title="Förälderns Google-konto">
                <p>En administratör kan ge en förälder Google-inloggning och koppla kontot till ett eller flera barn. Föräldern ser då Mina barn och en begränsad profil, inte tränarnas interna administration.</p>
              </Topic>
            </Chapter>

            <Chapter
              id="administration"
              number="11"
              title="Administration"
              intro="Administration styr vilka personer som får åtkomst och vilka lag eller spelare de får arbeta med. Fel här kan antingen blockera en användare eller ge för bred åtkomst."
            >
              <Topic title="Lägg till en användare">
                <Steps>
                  <Step title="Öppna Administration → Användare" />
                  <Step title="Ange namn och exakt Google-adress" />
                  <Step title="Välj minst en roll" />
                  <Step title="Koppla lag eller spelare vid behov" />
                  <Step title="Spara och be personen prova att logga in" />
                </Steps>
              </Topic>

              <Topic title="Funktionsåtkomst">
                <dl>
                  <Term name="Ärvd">Rollens standardregel används. Detta är normalt rätt val.</Term>
                  <Term name="Tillåt">Ger personen funktionen även om rollen normalt saknar den.</Term>
                  <Term name="Neka">Tar bort funktionen för just den personen.</Term>
                </dl>
                <Callout title="Använd undantag sparsamt" tone="note">
                  Många individuella undantag blir svåra att överblicka. Börja med rätt roll och använd Tillåt/Neka endast när ett verkligt specialfall finns.
                </Callout>
              </Topic>

              <Topic title="Lagåtkomst och kopplade spelare">
                <p>Om inget lag väljs har personal normalt åtkomst till alla lag som rollen tillåter. Välj ett eller flera lag för att begränsa personen. Föräldrar kopplas till sina barn och spelarrollen kopplas till den egna spelaren.</p>
              </Topic>

              <Topic title="Organisationens grupper">
                <dl>
                  <Term name="Huvudtrupp">Organisationens övergripande lag eller spelarbas.</Term>
                  <Term name="Undergrupp">Ett mer permanent lag inom huvudtruppen, exempelvis Gul eller Grön.</Term>
                  <Term name="Matchgrupp">En teknisk grupp som kan skapas för en cup eller ett särskilt matchsammanhang.</Term>
                </dl>
                <p>En spelare kan ingå i flera grupper. Det är användbart när laget delar spelarbas eller när en särskild cuptrupp tas ut.</p>
              </Topic>
            </Chapter>

            <Chapter
              id="installningar"
              number="12"
              title="Inställningar"
              intro="Inställningarna är indelade i Profil, Matcher, Laget, Trupp och Tränare. Ändringar här påverkar ofta hela appen."
            >
              <Topic title="Profil">
                <p>Här anger tränaren sitt visningsnamn. Namnet används bland annat i aktivitetsloggen och för att visa vem som gjort en åtgärd.</p>
              </Topic>

              <Topic title="Matchkalender">
                <Steps>
                  <Step title="Hämta lagets iCal-länk från kalenderleverantören" />
                  <Step title="Klistra in länken under Inställningar → Matcher" />
                  <Step title="Starta importen och kontrollera förhandsresultatet" />
                  <Step title="Kontrollera datum, tider, plats och motståndare på Matchersidan" />
                </Steps>
                <p>En senare import ska uppdatera kalenderinformation utan att ni behöver skapa varje match på nytt.</p>
              </Topic>

              <Topic title="Klubb, lag och visuellt tema">
                <p>Klubbnamn, lagnamn, säsong, klubbfärger och matchtröjor används på flera sidor. Kontrollera kontrasten i både ljust och mörkt läge när färger ändras. Standardfärgerna kan återställas.</p>
              </Topic>

              <Topic title="Trupp och spelarprofiler">
                <p>Här kan flera spelare läggas till och PIN-koder hanteras. Använd spelarprofilen när du behöver ändra mer detaljerad information om en enskild spelare.</p>
              </Topic>

              <Topic title="Tränarinloggning och inbjudan">
                <p>Snabbtillägg med Google-adress passar när administratören känner till adressen. En inbjudningslänk passar när mottagaren själv ska acceptera åtkomsten. Inbjudningslänken ska behandlas som en engångsnyckel.</p>
              </Topic>
            </Chapter>

            <Chapter
              id="arbetsfloden"
              number="13"
              title="Vanliga arbetsflöden"
              intro="De här checklistorna samlar funktionerna i den ordning de normalt används. De är bra som rutin för en tränarstab där flera personer delar på uppgifterna."
            >
              <Topic title="Inför en vanlig match">
                <Steps>
                  <Step title="Kontrollera datum, tid, plats och motståndare" />
                  <Step title="Sätt matchens svårighetsnivå" />
                  <Step title="Ta ut truppen med hänsyn till tidigare speltid" />
                  <Step title="Välj formation och preliminär startuppställning" />
                  <Step title="Bestäm vem som rapporterar matchen" />
                  <Step title="Dela Livescore-länken med dem som vill följa" />
                </Steps>
              </Topic>

              <Topic title="Efter en match">
                <Steps>
                  <Step title="Avsluta rapporteringen och kontrollera resultatet" />
                  <Step title="Rätta tydliga statistikfel" />
                  <Step title="Kontrollera att deltagande spelare är rätt" />
                  <Step title="Sätt matchbetyg när observationerna är färska" />
                  <Step title="Notera eventuella uppföljningar i tränarstaben" />
                </Steps>
              </Topic>

              <Topic title="Inför en cup">
                <Steps>
                  <Step title="Importera eller skapa cupen" />
                  <Step title="Kontrollera gruppspel, nivå och eventuella egna laggrupper" />
                  <Step title="Ta ut en gemensam cuptrupp" />
                  <Step title="Förbered matchtrupper och formationer" />
                  <Step title="Bestäm rapportörer och dela rätt länkar" />
                  <Step title="Lägg till slutspel först när lottningen är känd" />
                </Steps>
              </Topic>

              <Topic title="Månatlig spelaruppföljning">
                <Steps>
                  <Step title="Se över deltagande och saknad statistik" />
                  <Step title="Granska form som observationsstöd" />
                  <Step title="Läs nya självskattningar och samtal" />
                  <Step title="Uppdatera utvärderingar som blivit inaktuella" />
                  <Step title="Följ upp mål med spelaren och tränarstaben" />
                </Steps>
              </Topic>
            </Chapter>

            <Chapter
              id="felsokning"
              number="14"
              title="Felsökning och vanliga frågor"
              intro="Börja med de enkla kontrollerna nedan. Om problemet kvarstår, notera vilken sida du var på, vilken användare och roll som berörs samt ungefär när felet inträffade."
            >
              <Topic title="Jag kan inte logga in">
                <List>
                  <Item>Kontrollera att rätt Google-konto är valt.</Item>
                  <Item>Be administratören jämföra den registrerade adressen tecken för tecken.</Item>
                  <Item>Kontrollera att användaren har minst en aktiv roll.</Item>
                  <Item>Om inbjudningslänk används: be om en ny om länken redan accepterats eller blivit gammal.</Item>
                </List>
              </Topic>

              <Topic title="Jag ser inte en meny eller knapp">
                <p>Det beror oftast på roll eller funktionsåtkomst. Be en administratör kontrollera roll, individuella Tillåt/Neka-regler och eventuell lagbegränsning. På mobil kan funktionen även ligga under kugghjulet eller på en detaljsida.</p>
              </Topic>

              <Topic title="En match saknas eller har fel information">
                <List>
                  <Item>Kör kalenderimporten igen om matchen kommer från lagets kalender.</Item>
                  <Item>Kontrollera att kalender- eller cup-länken hör till rätt lag.</Item>
                  <Item>Redigera en enskild match manuellt när källans uppgifter är ofullständiga.</Item>
                  <Item>Kontrollera cupgrupp om flera egna lag spelar samma turnering.</Item>
                </List>
              </Topic>

              <Topic title="Statistiken ser fel ut">
                <List>
                  <Item>Öppna den aktuella matchen och kontrollera händelseflödet.</Item>
                  <Item>Använd Rätta statistik för enskilda värden.</Item>
                  <Item>Kontrollera att rätt spelare markerades som deltagare.</Item>
                  <Item>Kontrollera hur många matcher som faktiskt är statistikförda; alla spelade matcher behöver inte ha full statistik.</Item>
                </List>
              </Topic>

              <Topic title="Rapportören kan inte ändra matchen">
                <List>
                  <Item>Kontrollera att personen fått Rapportera-länken och inte Livescore-länken.</Item>
                  <Item>Kontrollera att rapporteringen är öppen eller att det är mindre än 60 minuter till avspark.</Item>
                  <Item>Ladda om sidan om matchen precis öppnades av en tränare.</Item>
                  <Item>En rapportör kan bara ångra sina egna senaste registreringar.</Item>
                </List>
              </Topic>

              <Callout title="När du ber om teknisk hjälp" tone="note">
                Skicka aldrig PIN-koder, inbjudningslänkar eller privata spelarlänkar i en öppen kanal. En skärmbild och en kort beskrivning av stegen fram till felet räcker oftast.
              </Callout>
            </Chapter>
          </article>
        </div>
      </div>
    </main>
  );
}
