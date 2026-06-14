import Link from "next/link";
import { IconArrowLeft, IconCheck } from "@/components/Icons";

export const metadata = { title: "Tränarguide – BSK F2014" };

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-xl font-bold mt-10 mb-4 pb-2"
      style={{ fontFamily: "var(--font-display)", borderBottom: "1px solid var(--line)" }}
    >
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-semibold text-[1rem] mt-6 mb-2" style={{ color: "var(--ink)" }}>
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--ink-soft)" }}>
      {children}
    </p>
  );
}

function Step({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex gap-3 mb-4">
      <span
        className="shrink-0 flex h-6 w-6 mt-0.5 items-center justify-center rounded-full text-xs font-bold"
        style={{ background: "var(--primary)", color: "var(--primary-deep)", fontFamily: "var(--font-display)" }}
      >
        {n}
      </span>
      <div>
        <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{title}</p>
        {children && (
          <p className="text-sm mt-0.5 leading-relaxed" style={{ color: "var(--ink-soft)" }}>{children}</p>
        )}
      </div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex gap-2.5 text-sm rounded-xl px-4 py-3 my-3"
      style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
    >
      <span className="shrink-0 mt-0.5">
        <IconCheck width={14} height={14} strokeWidth={2.5} />
      </span>
      <span>{children}</span>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-sm rounded-xl px-4 py-3 my-3 leading-relaxed"
      style={{ background: "var(--bg2)", border: "1px solid var(--line)", color: "var(--ink-soft)" }}
    >
      {children}
    </div>
  );
}

function TocLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="flex items-center gap-2 text-sm py-1 transition-colors hover:text-[var(--primary)]"
      style={{ color: "var(--ink-soft)" }}
    >
      <span className="h-px w-4 shrink-0" style={{ background: "var(--line)" }} />
      {children}
    </a>
  );
}

export default function GuidePage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium mb-6 transition-colors hover:text-[var(--primary)]"
          style={{ color: "var(--ink-faint)", fontFamily: "var(--font-display)" }}
        >
          <IconArrowLeft width={14} height={14} /> Tillbaka
        </Link>

        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          Tränarguide
        </h1>
        <p className="mt-2 text-sm mb-8" style={{ color: "var(--ink-soft)" }}>
          Komplett genomgång av alla funktioner i BSK F2014-appen – för dig som är ny tränare.
        </p>

        {/* Innehållsförteckning */}
        <div
          className="rounded-2xl p-5 mb-8 space-y-0.5"
          style={{ background: "var(--bg2)", border: "1px solid var(--line)" }}
        >
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--ink-faint)", fontFamily: "var(--font-display)" }}>
            Innehåll
          </p>
          <TocLink href="#inloggning">1. Inloggning</TocLink>
          <TocLink href="#oversikt">2. Översikten</TocLink>
          <TocLink href="#matcher">3. Matcher</TocLink>
          <TocLink href="#liverapportering">4. Liverapportering</TocLink>
          <TocLink href="#spelare">5. Spelare och trupp</TocLink>
          <TocLink href="#utvarderingar">6. Utvärderingar</TocLink>
          <TocLink href="#statistik">7. Statistik</TocLink>
          <TocLink href="#intervjuer">8. Spelarintervjuer (AI)</TocLink>
          <TocLink href="#spelarprofiler">9. Spelarprofiler och PIN</TocLink>
          <TocLink href="#installningar">10. Inställningar</TocLink>
          <TocLink href="#foraldrar">11. För föräldrar och rapportörer</TocLink>
        </div>

        {/* 1. Inloggning */}
        <section id="inloggning">
          <H2>1. Inloggning</H2>
          <P>
            Det finns två sätt att logga in som tränare: med Google-konto eller med tränarkoden. Föräldrar
            och rapportörer använder en separat föräldrakod.
          </P>

          <H3>Logga in med Google (rekommenderat)</H3>
          <Step n={1} title="Gå till inloggningssidan">
            Öppna appen och klicka på <strong>Tränare</strong> på startsidan, eller gå direkt till <strong>/login</strong>.
          </Step>
          <Step n={2} title='Klicka på "Logga in med Google"'>
            Du omdirigeras till Google. Välj ditt Google-konto.
          </Step>
          <Step n={3} title="Klart – du är inloggad">
            Du hamnar direkt på Översikten. Din inloggning håller i 90 dagar.
          </Step>
          <Tip>
            Din Gmail-adress måste vara godkänd av en befintlig tränare under Inställningar → Tränarinloggning med Google. Kontakta admin om du får felmeddelande.
          </Tip>

          <H3>Logga in med tränarkod</H3>
          <P>
            Ange den delade tränarkoden i fältet <strong>Föräldrakod / Tränarkod</strong> på inloggningssidan. Koden hittar du (eller ändrar) under Inställningar.
          </P>

          <H3>Logga ut</H3>
          <P>
            Klicka på din avatar uppe till höger i navigeringen och välj <strong>Logga ut</strong>.
          </P>
        </section>

        {/* 2. Översikten */}
        <section id="oversikt">
          <H2>2. Översikten</H2>
          <P>
            Översikten är startsidan för tränare och ger en snabb lägesbild av laget.
          </P>

          <H3>Hero-kortet (överst)</H3>
          <P>
            Visar lagets namn, spelform och säsong. Till höger ser du de <strong>2 närmaste kommande matcherna</strong> med datum, motståndare och hemma/borta. Klicka på en match för att komma direkt till matchsidan.
          </P>
          <P>
            Under lagnamnet finns tre snabblänkar: <strong>Registrera match</strong>, <strong>Rapportera statistik</strong> och <strong>Till truppen</strong>.
          </P>

          <H3>Statistikkort (4 st)</H3>
          <P>
            Fyra kort visar nyckeltal för säsongen: antal aktiva spelare, totalt antal matcher, antal utvärderingar gjorda, och antal spelare som behöver utvärderas (markeras orange om det finns sådana).
          </P>

          <H3>Dags att utvärdera</H3>
          <P>
            Listar alla spelare som <em>inte</em> fått en utvärdering på mer än 60 dagar. Klicka direkt på en spelare för att komma till utvärderingsformuläret. Är alla aktuella visas en grön bekräftelse.
          </P>

          <H3>Jämnt deltagande</H3>
          <P>
            Visar spelare som spelat färre än 75 % av lagets matchsnitt – enligt SvFF:s riktlinje att alla ska få spela lika mycket. Dessa bör prioriteras i nästa match.
          </P>
        </section>

        {/* 3. Matcher */}
        <section id="matcher">
          <H2>3. Matcher</H2>

          <H3>Skapa en ny match</H3>
          <Step n={1} title='Klicka på "Registrera match" eller gå till Matcher → Lägg till match' />
          <Step n={2} title="Fyll i matchuppgifter">
            Datum, motståndare, hemma/borta, matchtyp (seriespel, cup, träningsmatch) och eventuellt cupnamn om det är en turnering.
          </Step>
          <Step n={3} title="Ange avsparktid och perioder">
            Avsparktiden avgör när rapporteringen öppnar (15 min innan). Välj antal perioder (3 för seriespel, 2 för cup) och minutlängd (standard 20 min).
          </Step>
          <Step n={4} title="Dela länken med föräldrar">
            På matchsidan visas en <strong>Kopiera länk</strong>-knapp. Skicka länken i WhatsApp-gruppen – föräldrarna klickar och hamnar direkt i liverapporteringen utan att behöva logga in.
          </Step>
          <Tip>
            Du kan också importera matcher automatiskt från svenskalag.se via Inställningar → Matchkalender. Alla kommande matcher med datum och motståndare läggs in utan manuell inmatning.
          </Tip>

          <H3>Matchsidan</H3>
          <P>
            Varje match har en egen sida med: resultat och matchfakta, spelartrupp med spelade minuter, mål och passningar, matchhändelser i tidsordning, och möjlighet att lägga till händelser manuellt (t.ex. från videogenomgång).
          </P>
          <P>
            <strong>Laguttagning</strong> – välj vilka spelare som är med i matchtruppen och placera dem på planen med drag-och-släpp. Formationen sparas per match.
          </P>

          <H3>Nollställa en match</H3>
          <P>
            Om något gick fel kan du nollställa matchen under matchsidan. Det rensar all statistik och klockan – matchen finns kvar men börjar om från noll.
          </P>
        </section>

        {/* 4. Liverapportering */}
        <section id="liverapportering">
          <H2>4. Liverapportering</H2>
          <P>
            Liverapporteringen är designad för att användas av föräldrar på sidan av planen – men du som tränare kan också öppna den.
          </P>

          <H3>Starta matchen</H3>
          <P>
            Öppna matchlänken eller gå till <strong>/rapportera</strong>. Tryck <strong>Starta period 1</strong> när matchen drar igång. Matchklockan tickar live och synkas för alla som är inloggade på matchen.
          </P>

          <H3>Statistik som kan rapporteras</H3>
          <Note>
            <strong>Mål</strong> · Passningar · Skott · Skott på mål · Brytningar · Räddningar (målvakt) · Gula kort · Röda kort · Inbytningar
          </Note>
          <P>
            Varje händelse sparas med klockslag och period. Flera föräldrar kan rapportera <em>olika</em> statistiktyper samtidigt utan att de krockar – appen fördelar automatiskt ansvar per rapportör.
          </P>

          <H3>Avsluta matchen</H3>
          <P>
            Klicka <strong>Avsluta match</strong> när sista perioden är klar. Rapporteringen stängs för alla och matchen markeras som avslutad. Appen avslutar automatiskt om 5 minuter passerar efter sista periodens slut.
          </P>

          <H3>Lägga till händelser i efterhand</H3>
          <P>
            På matchsidan (för tränare) finns ett formulär under händelseflödet: välj spelare, typ, period och tid. Används vid videogenomgång för att komplettera statistiken efter matchen.
          </P>
        </section>

        {/* 5. Spelare */}
        <section id="spelare">
          <H2>5. Spelare och trupp</H2>

          <H3>Truppen</H3>
          <P>
            Under <strong>Spelare</strong> listas alla aktiva spelare med tröjnummer, position och senaste utvärderingsdatum. Klicka på en spelare för att se hela profilen: matchstatistik, utvärderingshistorik och utvärderingsgraf per SvFF-kategori.
          </P>

          <H3>Lägga till en spelare</H3>
          <Step n={1} title='Klicka på "Lägg till spelare"' />
          <Step n={2} title="Fyll i namn, tröjnummer och position">
            Position-fältet används av AI-intervjun för att anpassa frågorna.
          </Step>

          <H3>Spelarkortet (delbart)</H3>
          <P>
            Varje spelare kan få ett eget delbart spelarkort – en länk med en sammanfattning av styrkor och mål. Genereras under spelarens profilsida med knappen <strong>Generera spelarkort</strong>. Länken är giltig i 30 dagar.
          </P>

          <H3>Avaktivera en spelare</H3>
          <P>
            Spelare som slutat syns inte längre i truppen men deras statistik bevaras. Avaktivera under spelarens profilsida.
          </P>
        </section>

        {/* 6. Utvärderingar */}
        <section id="utvarderingar">
          <H2>6. Utvärderingar</H2>
          <P>
            Appen bygger på SvFF:s färdighetsmodell med fem kategorier. Varje spelare utvärderas på en skala 1–4 per färdighet.
          </P>

          <H3>SvFF:s fem kategorier</H3>
          <Note>
            <strong>Anfall med boll</strong> – teknisk förmåga, dribbling, skott<br />
            <strong>Anfall utan boll</strong> – rörelsearbete, löpningar i djupet<br />
            <strong>Försvar</strong> – press, positionering, duellstyrka<br />
            <strong>Fysik</strong> – uthållighet, explosivitet, koordination<br />
            <strong>Psykosocialt</strong> – laganda, kommunikation, attityd
          </Note>

          <H3>Göra en utvärdering</H3>
          <Step n={1} title="Gå till Spelare → välj spelare → Utvärdera" />
          <Step n={2} title="Välj nivå 1–4 för varje färdighet">
            1 = Behöver mycket stöd, 2 = Under förväntad nivå, 3 = På förväntad nivå, 4 = Över förväntad nivå.
          </Step>
          <Step n={3} title="Fyll i styrkor och utvecklingsmål">
            Dessa texter visas för spelaren på hennes profil i appen – skriv konstruktivt.
          </Step>
          <Step n={4} title='Klicka "Spara utvärdering"'>
            Utvärderingen sparas med datum och syns i spelarens historik som ett linjediagram.
          </Step>
          <Tip>
            Översikten påminner dig när det gått mer än 60 dagar sedan senaste utvärderingen. Sikta på minst en utvärdering per kvartal.
          </Tip>

          <H3>Jämförelse med spelarens egen bild</H3>
          <P>
            Under <strong>Intervjuer</strong> kan du se hur spelarens självskattning (från kvartalsutvärderingen) stämmer mot din bedömning – färdighet för färdighet. Stor skillnad markeras som "bra att diskutera" vid nästa spelarsamtal.
          </P>
        </section>

        {/* 7. Statistik */}
        <section id="statistik">
          <H2>7. Statistik</H2>
          <P>
            Statistiksidan visar en säsongssammanställning för hela truppen. Du ser varje spelares totala antal matcher, mål, passningar, skott och mer. Sortera på valfri kolumn.
          </P>
          <P>
            Deltagandegraf visar hur jämnt matchminuterna fördelar sig i truppen – ett krav enligt SvFF:s riktlinjer för barnfotboll.
          </P>
        </section>

        {/* 8. Spelarintervjuer */}
        <section id="intervjuer">
          <H2>8. Spelarintervjuer (AI)</H2>
          <P>
            AI-intervjuerna låter spelaren prata med en AI-coach inför spelarsamtalet eller kvartalsutvärderingen. Svaren sparas och är tillgängliga för dig under Intervjuer.
          </P>

          <H3>Intervjutyper</H3>
          <Note>
            <strong>Spelarsamtal</strong> – 6 öppna frågor om säsongen: vad spelaren är nöjd med, vad hon vill bli bättre på, hur hon trivs i laget, m.m. Passar inför sommaruppehåll och halvårsmöten.<br /><br />
            <strong>Kvartalsutvärdering</strong> – AI ställer 5 frågor kopplade till SvFF:s kategorier och ber spelaren sätta betyg 1–4. Resultaten jämförs sedan med din tränarpoäng under Intervjuer.
          </Note>

          <H3>Så startar spelaren en intervju</H3>
          <Step n={1} title="Spelaren loggar in med sin PIN-kod på /spelare/login" />
          <Step n={2} title="Trycker på Starta intervju på sin profilsida" />
          <Step n={3} title="Väljer intervjutyp och genomför chatten">
            AI bekräftar vem spelaren är (via spelardatabasen) och ställer frågorna en i taget. Intervjun avslutas automatiskt när alla frågor är klara.
          </Step>

          <H3>Se avslutade intervjuer</H3>
          <P>
            Under <strong>Intervjuer</strong> i menyn ser du alla genomförda intervjuer med datum, spelarens svar och – för kvartalsutvärderingar – ett stapeldiagram som jämför spelarens självbild mot din tränarpoäng per SvFF-kategori.
          </P>
          <Tip>
            Använd intervjun som underlag inför spelarsamtalet. Om spelaren och du har väldigt olika uppfattning om en kategori är det ett bra samtalstema.
          </Tip>
        </section>

        {/* 9. Spelarprofiler */}
        <section id="spelarprofiler">
          <H2>9. Spelarprofiler och PIN-koder</H2>
          <P>
            Varje spelare kan logga in i appen med en personlig 6-siffrig PIN-kod. De ser då sin egen profil med senaste utvärdering, matchantal och kan starta en intervju.
          </P>

          <H3>Generera PIN för en spelare</H3>
          <Step n={1} title="Gå till Inställningar → Spelarprofiler" />
          <Step n={2} title='Klicka på "Generera PIN" bredvid spelarens namn'>
            En unik 6-siffrig kod skapas. Koden visas direkt på sidan.
          </Step>
          <Step n={3} title="Dela PIN-koden med spelaren (eller föräldern)">
            Spelaren går till startsidan → Spelare → anger koden. PIN-koden gäller tills en ny genereras.
          </Step>
          <Tip>
            Trycket på "Ny PIN" ersätter den gamla – den gamla koden slutar fungera omedelbart.
          </Tip>
        </section>

        {/* 10. Inställningar */}
        <section id="installningar">
          <H2>10. Inställningar</H2>
          <P>
            Nås via kugghjulet i menyn. Alla inställningar är klubbspecifika och gäller för alla inloggade tränare.
          </P>

          <H3>Matchkalender (iCal från svenskalag.se)</H3>
          <P>
            Klistra in iCal-länken från ditt lags sida på svenskalag.se (under Exportera kalender) och klicka <strong>Hämta matcher nu</strong>. Matcher med ord som "match", "sammandrag" eller "cup" i titeln importeras automatiskt.
          </P>

          <H3>Klubb och lag</H3>
          <P>
            Ändra klubbnamn, lagnamn och säsong. Dessa visas på startsidan och i all statistik.
          </P>

          <H3>Klubbfärger och tröjor</H3>
          <P>
            Primärfärgen används i gränssnittet. Utespelartröjan och målvaktströjan visas som avatarer på alla spelarsidor. Välj rätt färger så det matchar lagets riktiga tröjor.
          </P>

          <H3>Inloggningskoder</H3>
          <P>
            Tränarkod och föräldrakod kan ändras här. Tränarkoden ger full åtkomst. Föräldrakoden ger åtkomst till matchstatistik och rapporteringsverktyget.
          </P>

          <H3>Tränarinloggning med Google</H3>
          <P>
            Lägg till Gmail-adresser för varje tränare som ska kunna logga in med Google. Adressen måste stämma exakt med det Google-konto tränaren använder. Klicka <strong>Ta bort</strong> för att återkalla åtkomst.
          </P>

          <H3>Bjud in tränare</H3>
          <P>
            Generera en engångslänk giltig i 48 timmar. Skicka länken till en ny tränare – de klickar och får direkt tränaråtkomst utan att behöva koden. Länken slutar fungera när den använts.
          </P>

          <H3>Spelarprofiler (PIN-koder)</H3>
          <P>
            Se och generera PIN-koder för alla aktiva spelare. Beskrivs utförligare under avsnitt 9 ovan.
          </P>
        </section>

        {/* 11. Föräldrar */}
        <section id="foraldrar">
          <H2>11. För föräldrar och rapportörer</H2>
          <P>
            Föräldrar behöver inte logga in för att rapportera statistik – de använder direktlänken du delar eller föräldrakoden.
          </P>

          <H3>Rapportera statistik under match</H3>
          <Step n={1} title="Öppna länken tränaren delar i gruppchatten">
            Alternativt: gå till startsidan → Förälder och rapportör → ange matchkoden (6 siffror) som visas på matchsidan.
          </Step>
          <Step n={2} title="Ange ett namn och välj statistiktyp">
            Om en annan förälder redan valt en typ visas den gråad med deras namn – välj en annan.
          </Step>
          <Step n={3} title="Tryck på spelarens namn när det händer">
            Händelsen sparas direkt med klockslag. En Ångra-knapp visas för senaste händelsen.
          </Step>
          <Tip>
            Dela gärna upp ansvaret – en förälder räknar mål och passningar, en annan brytningar och skott. Flera kan rapportera samtidigt utan att det krockar.
          </Tip>

          <H3>Bocka av spelarna efter matchen</H3>
          <P>
            Under fliken <strong>Spelade</strong> i rapporteringsverktyget bockar ni av vilka spelare som var med i matchen. Detta används för deltagandespårningen.
          </P>
        </section>

        <div
          className="mt-12 mb-4 pt-6 text-center text-xs"
          style={{ borderTop: "1px solid var(--line)", color: "var(--ink-faint)" }}
        >
          BSK F2014 · Bollstanäs SK
        </div>
      </div>
    </div>
  );
}
