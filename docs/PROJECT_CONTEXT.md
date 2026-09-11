# BSK App - Project Context

## Gällande beslut 2026-09-10: enbart webbapp

Native/iOS ingår inte längre i produkten eller den aktiva planen. All fortsatt
utveckling och verifiering gäller bsk2014.se i webbläsaren på mobil, iPad och dator.
Äldre nativebeslut nedan är historik. Befintlig nativekod lämnas tills vidare;
installation, simulatorbyggen och nativeparitet är inga leveranskrav.
Svenska Lag är fortsatt master för matcher, kallelser, svar och närvaro.


## Beslut och implementation 2026-09-09: webbapp och lugn klubbidentitet

Användaren pausar iOS-utvecklingen och prioriterar en gemensam webbapp. Den godkända lugna designriktningen är nu implementerad lokalt i huvudappen: varmvit bas, dämpat mörkt läge, originalmärke, neutral spelarnummeravatar, mobilnavigation och behörighetsstyrd verktygsmeny. Idag prioriterar nästa match inom veckans befintliga datakälla samt spelarutveckling; veckosiffror och matchutrymme finns som fördjupning. Träd, fokus, samtal, behörigheter och datamodell bevaras. Ingen nativekod ändrad.

Se `docs/WEB_DESIGN_2026-09-09.md` för omfattning och verifiering. Ändringarna publicerades 2026-09-09; se releaseprotokoll nedan. Detta är ett visuellt steg i huvudappen, inte full sammanslagning av Coach/Development.


## Beslut 2026-08-28: samma matcharbetsflöden i webb och native

- Webbens matchöversikt använder samma kanoniska truppresolver som native och
  länkar kommande Lag Gul-matcher till den gemensamma checkbox-uttagningen.
  Den äldre matchbundna laguttagningssidan omdirigerar dit och är endast kvar
  för cup- och övriga matchgrupper som ännu använder formationer.
- Webbens matchutvärdering använder samma servertjänst, 90-minutersgräns,
  slutresultat, Matchcenter-låsning, tränarkommentar, spelarbedömningar och
  avslutningsregler som native.
- Matchcenter och Utvärdera visas och kan öppnas i webben endast för Lag Gul
  och när användaren har motsvarande behörighet. Lag Grön är fortsatt
  skrivskyddad matchinformation.

## Beslut 2026-08-26: iPad är primär arbetsyta

- Nativeappens iPad-layout bygger inte längre på ett krav om två eller tre
  kolumner. iPad har en sammanhängande arbetsyta med en kompakt global
  navigationsrad i toppen. Match, träning, spelare och uttagning öppnas i en
  vanlig navigationsstack och använder hela arbetsytan.
- Toppraden visar namnet endast på aktiv arbetsyta; övriga arbetsytor använder
  tydliga symboler. Det håller navigeringen lugn och användbar även i stående
  iPad och smalare Stage Manager-fönster.
- Idag är omgjord som en prioriterad arbetsyta: lägesrubrik, en sammanhållen
  veckosummering, aktuella handlingar, matchvecka och spelarbelastning. Separata
  dashboardkort och passiva detaljytor är borttagna från grundmodellen.
- Färg, typografi och ytor är nedtonade: färre konturer och skuggor, mjukare
  accentfärg och tydligare innehållshierarki.
- Huvudarbetsytorna kan bytas med hårdvarutangentbordets Kommando-1 till
  Kommando-5 och Konto med Kommando-komma. Interaktiva iPad-kort har synlig
  pekarfeedback utan att ändra iPhone-navigationen.

## Beslut 2026-08-26: belastningsgränser för matcher

- Matchbelastning bedöms i ett rullande fönster med spelade matcher de senaste
  sju dagarna och bekräftade eller planerade matcher de kommande sju dagarna.
- `Normal`: högst fyra matcher totalt och högst två kommande. Exempelvis 2
  spelade + 2 kommande är normalt.
- `Vid maxgränsen`: fem matcher totalt eller exakt tre kommande, så länge ingen
  regel för för hög belastning träffar. Det omfattar bland annat 0–2 spelade +
  3 kommande, 3 + 2 och 4 + 1.
- `För hög belastning`: minst sex matcher totalt, minst fyra kommande eller
  minst fem redan spelade.
- `lib/matchCapacity.ts` är gemensam regelmotor. Webbens Idag-vy, mobile API,
  native Idag och uttagningsstödet visar separata antal för spelade och
  kommande matcher och använder samma tre nivåer. Regeln beskriver
  matchexponering, inte medicinsk status.

## Beslut 2026-08-26: ett gemensamt native-matchnav

- Alla matchingångar i native — Idag, Matcher, Utvärdera och Uttagning — öppnar
  samma matcharbetsyta i stället för separata detaljvyer.
- Arbetsytan har en beständig matchrubrik och områdena `Översikt`, `Trupp`,
  `Matchcenter` och `Utvärdera`. Ingången avgör vilket område som öppnas först,
  men användaren stannar i samma matchkontext när området byts.
- Översikt och trupp finns alltid. Matchcenter och Utvärdera visas bara för Lag
  Gul med rätt behörighet; Utvärdera visas först när matchen är redo för
  utvärdering. Lag Grön är fortsatt läsbar utan skrivfunktionerna.
- Uttagningens befintliga redigerare och Matchcenters befintliga arbetsflöde är
  inbäddade i matchnavet. Sparad trupp laddar om den gemensamma appmodellen och
  slutförd utvärdering återgår till matchens översikt.

## Beslut 2026-08-26: dockad native-meny med fri scrollbotten

- Den kompakta native-navigationen är dockad mot skärmens nederkant i stället
  för att ligga som en flytande kapsel ovanpå innehållet.
- Idag, Matcher, Utvärdera, Spelare och Uttagning har ett gemensamt kompakt
  bottenutrymme så sista kortet alltid kan rullas helt ovanför menyn och
  telefonens safe area. iPadens separata toppnavigation påverkas inte.

## Beslut 2026-08-25: en gemensam spelartrupp per match

- Matchkort, observation, native Matchcenter och matchutvärdering ska använda
  samma serverside-resolver i `lib/matchRoster.ts` i stället för egna
  definitioner av vilka spelare som hör till matchen.
- För en spelad match är `match_players` facit. För en kommande match är
  `match_roster` enda sanningskälla för kallelse, svar, tränarbeslut, vald position
  och startplacering. En lagmedlemslista används inte som påhittad matchtrupp.
- `hasConfirmedSquad` betyder att minst en `match_roster`-rad har
  `selection_status='selected'`.
- Beslut 2026-08-27: `players` och `matches` är enda huvudlistorna. Uttagning
  listar direkt från `matches`; `development_activities` är endast kontext för
  observationer. Migration 0017 samlar förmatchdata i `match_roster`, och 0018
  ersätter de gamla lagringstabellerna med skrivskyddade projektioner utan egen data.
  Migration 0019 säkerställer att historiska ja-svar alltid blir uttagna och att
  nej/inväntar blir vilade enligt samma regel som nya importer.

## Beslut 2026-08-24: utvecklingsträdet är en aktiv del av spelarprofilen

- Utvecklingsträdet har lyfts från "äldre utvecklingsarkiv" till en aktuell,
  synlig del av spelarprofilen med nuläge, direkt ingång och senaste sparade
  historik.
- Den synliga arbetsbenämningen är `Uppdatera utvecklingsbild`, inte en separat
  generell utvärdering eller avstämning. Den befintliga checkpointmodellen och
  historiken bevaras oförändrade inför kommande integration med spelarsamtal.
- Själva trädet är en läsvy. Status, fokus och sammanfattning ändras samlat via
  `Uppdatera utvecklingsbild`, så aktuellt nuläge och historik inte kan glida
  isär genom odokumenterade snabbändringar.
- Utvecklingsvyerna använder kärnvyerna `core-*`-design, klubbens primärfärg och
  rena områdesnamn. Kategorisymboler och dekorativa markörer visas inte.
- Samma modell är nu tillgänglig i nativeappen från spelarprofilen. Mobilvyn
  visar nuläge, fokus, samtliga färdigheter och sparar status och sammanfattning
  tillsammans via `Uppdatera utvecklingsbild`; webb och native delar tabeller,
  behörigheter och historik men använder plattformsanpassade gränssnitt.
- Native utvecklingsträd har en tydlig primär åtgärd inne på sidan för att
  uppdatera utvecklingsbilden. I uppdateringsläget visas samtliga fyra statusar
  direkt som tryckbara val per färdighet; ingen dold dropdown krävs.
- Samtliga färdighetstexter är neutrala tränarbedömningar i påståendeform,
  exempelvis `Kan driva bollen ...`, i stället för frågor riktade direkt till
  spelaren.
- Native spelarlista filtreras på aktuellt lagmedlemskap och öppnar alltid med
  `Gul` valt. Tränaren kan därefter växla till Grön, övriga behöriga lag eller
  Alla utan att lämna spelarvyn. Endast permanenta undergrupper räknas som lag;
  cupimportens matchgrupper, exempelvis `com`, `comp` och `friendly`, filtreras
  bort vid API-källan och kan inte visas som spelarfilter.

## Beslut 2026-08-20: enkel matchutvärdering

- Den oanvända ELO-prototypen är borttagen, inklusive `match_ratings`, `players.form_rating`, statistikförslag och formdiagram.
- Varje spelare bedöms med två trestegsval: jämfört med sin vanliga nivå samt hur väl spelaren fungerade på matchnivån. Minuter och positionsjämförelser används inte.
- Spelar- och matchnivå sparas som ögonblicksbilder. Flera bedömare sammanställs till en trendpunkt per spelare och match; stor spridning visas som “Olika bild”.
- Inloggade tränare utvärderar under `/matcher/[id]/utvardera`. Matchsidan kan skapa separata, hashade och återkallningsbara länkar som gäller i sju dagar till publika `/matchutvardering/[token]`.
- Den publika länken är capability-avgränsad till en match och visar bara matchmetadata, deltagarnas namn och utvärderingsfrågorna.

## Syfte

BSK App ar en Next.js-app for Bollstanas SK F2014 med fokus pa spelarutveckling, matcher, live-rapportering och administration.

## Kallprioritet

1. repots kod och lokala docs
2. `docs/CODEMAP.md`
3. Obsidian-projektsidan `Projects/bsk-app.md`
4. GBrain endast som fallback

## Nuvarande projektlage

- Projektet ar aktivt
- Lokal testmiljo finns for utveckling utan prod-DB
- Behörighet, gruppscope och liveåtkomst är härdade och regressionstestade. GDPR:s tekniska utdrags-, raderings- och återställningsdel är byggd; föreningsbeslut och driftinventering återstår.
- Utvecklingstrappan (spelarutveckling 7v7->9v9) byggd 2026-07-09 och sammanfogad med spelarutvarderingen 2026-07-18. `/spelare/[id]/utveckling` ar nu den gemensamma arbetsytan for oversikt, aktuellt fardighetstrad och historiska avstamningar. `/utvardera` ar en kompatibilitetsredirect till `/utveckling/avstamning`. Varje avstamning sparar en snapshot i `development_checkpoints` + `development_checkpoint_skills` och uppdaterar aktuellt lage i `player_skill_status`; aldre SvFF-utvarderingar bevaras separat som lasbar historik.
- Spelarsamtal är en separat historik i `player_conversations`, inte ett annat namn
  på utvecklingsträdets checkpoints. Webb och native sparar samtalsdatum,
  tränarens sammanfattning, spelarens perspektiv, överenskomna nästa steg och
  frivilligt uppföljningsdatum. Den senaste utvecklingsbilden på eller före
  samtalsdatumet länkas som kontext utan att samtalet ändrar trädet.

## Nasta steg

- Produktomstart beslutad 2026-08-18: appens primara uppgift ar att hjalpa
  tranarna utveckla varje spelare och ta ut balanserade, utvecklande matchtrupper.
  Svenska Lag ska fortsatt aga kalender, kallelser och narvaro; BSK-appen ska
  inte duplicera dessa floden. Appen ska i stallet aga utvecklingsmal,
  malanknutna observationer fran traning och match, deltagande/exponering samt
  transparent beslutsstod for uttagning. Match-, cup-, live-, detaljstatistik-,
  ovningsritar- och administrationsfunktioner ar sekundara tills denna karna ar
  bevisad i verklig tranarvardag. Planlinjen ar en UX-referens, inte en fortsatt
  parallell produkt eller separat sanningskalla.
- Fas 1-3 i produktomstarten byggda 2026-08-18 i huvudappen. `/idag`,
  `/observera`, `/spelare` och `/uttagning` ar enda primara navigationen.
  Datamodellen har kanoniska aktiviteter, hogst tva aktiva utvecklingsmal,
  malanknuten evidens, deltagande/exponering och explicita uttagningsbeslut.
  Befintlig kalender-, match- och narvaroimport speglas idempotent; Svenska Lag
  forblir kalla. Uttagningsstodet ger enbart forklarbara mojligheter och
  balansvarningar, aldrig poang/ranking/automatval. Fas 4 har teknisk matning i
  `/idag`; verklig fyraveckorspilot aterstar och far inte slutmarkeras i fortid.
- Uttagningen har sedan 2026-08-19 en explicit knappstyrd rekommendationsmotor
  för Gulmatcher. Den rättvisejämför endast ordinarie Gulspelares Sanktan-
  kallelser, räknar även redan planerade kommande uttagningar och använder F15
  samt därefter Grön endast som utfyllnad. Förslaget är transparent, går att
  ångra och sparas aldrig utan tränarens separata bekräftelse.
- Designkorrigering 2026-08-18: kärnvyerna har ett lugnare, tätare visuellt
  språk med systemtypografi, mindre rubriker, kompakta aktivitets-/spelarkort,
  datumorientering och responsiva arbetsformulär. Ett separat leveransfel
  rättades samtidigt: service workern använde evig cache-first för Next-CSS,
  vilket kunde kombinera ny HTML med gammal CSS och ge en nästan ostylad sida.
  Cache `bsk-v2` använder nätverk först för `/_next/static/` och registreras inte
  i utvecklingsläge.
- Beslut 2026-08-10: allt generativt AI-arbete ar pausat. AI-routes, AI-intervjuer, AI-forslag, AI-genererade spelarkortstexter och Anthropic-beroendet ar borttagna. Fokus ar en fungerande tranar- och utvecklingsplattform; regelbaserade rekommendationer ar kvar.
- Sakerhetshardning 2026-08-10: coach-platform kraver signerad tranaridentitet i Proxy, root layout, export och samtliga server actions. Huvudappens publika liverapportering kraver nu matchspecifik capability-token medan Livescore forblir publik. Matchbetyg behandlar bara faktiska matchdeltagare. Vitest, Playwright och lokalt liveprotokoll ar inkopplade.
- Produktionshardning 2026-08-10: båda apparna kör Next 16.3.0 med ren dependency-audit och nätoberoende huvudappsbygge. Huvudappen har 10 Vitest-tester och 36/36 liveprotokollsteg; Planlinjen har 13 Vitest + 3 Playwright. Båda har spelarutdrag och permanent radering. Planlinjens versionsmigrering och backup/restore är verifierade mot 27 tabeller.
- Planlinjen är deployad bakom BSK-sessionen på `https://bsk2014.se/coach/`.
  Nginx hämtar en högst 90 sekunder gammal HMAC-identitet från huvudappen och
  nollställer klientskickade identitetsheaders. Den gamla öppna demon på
  `https://klvr.se/coach/` omdirigeras. Deploy `31381324085` verifierade båda
  tjänsterna, migration, osignerad 401, signerad intern åtkomst och publik
  login-redirect. Workflowen deployar framöver båda apparna tillsammans.
- VPS är enda produktionsmål. Vercels felaktiga automatiska `main`-byggen är
  avstängda i `vercel.json`; oanvända Anthropic-, Moonshot- och Turso-hemligheter
  är borttagna därifrån. Vercel Preview väntar på en separat staging-Postgres
  och Google OAuth-redirect och får inte återanvända VPS-produktionsdatabasen.
- VPS-databaserna är loopback-bundna på port 5433/5434 och Planlinjens
  återställningsprov passerade mot den verkliga driftdatauppsättningen (27
  tabeller). Ingen schemalagd eller extern BSK-/Planlinjen-backup hittades och
  UFW är inaktiv; backupmål/retention/RPO/RTO samt leverantörens brandvägg är
  kvar som uttryckliga förenings-/driftbeslut i `docs/DRIFT-OCH-BITRADEN.md`.
- Planlinjens skade-/hälsostatus är borttagen genom dataminimering. UI,
  TypeScript, Zod och server-action-allowlist accepterar inte längre `injured`;
  migration 004 konverterar äldre pilotvärden till vanlig frånvaro och bygger
  om databas-enumen utan hälsostatus.
- Krypterad backupmekanism och systemd-enheter är byggda i `deploy/backup/`.
  Flödet kräver separat mount, rootnyckel och beslutade policyvärden och gör ett
  fullständigt isolerat återställningsprov med tabellantal för båda databaserna
  före atomisk publicering. Hela kedjan är verifierad på VPS med temporär
  separat mount, checksummor och efterföljande artefaktkontroll. Det är
  medvetet inte aktiverat utan valt externt lagringsmål, retention och RPO/RTO.

- Milstolpe 4 i tranarplattformen (ovningsritare) ombyggd och deployad 2026-07-13 efter jämförelse med riktiga fotbollsövningar: statisk objektbaserad SVG-ritare med planmallar, separata färgverktyg för spelare/motståndare/målvakt, boll, koner, pinnar, mål, zoner, text och tydliga linjetyper. Spelare och boll har samma storlek. Pilar kan göras med två klick eller genom att dra och har större träffyta vid markering. Animation/sekvensspelare borttagen. Persistence mot `exercise_diagrams` verifierad efter rättning till `sql.json`. Route `/ovningar/[id]/ritare`. Se `coach-platform/docs/exercise-format.md`.
- Tränarplattformens milstolpar 1–7 och den tekniska delen av milstolpe 8 är
  byggda och driftsatta. Milstolpe 8 kan inte slutmarkeras förrän föreningens
  GDPR-/driftbeslut är protokollförda.
- Hall denna fil och `docs/CODEMAP.md` i sync nar projektets viktiga orienteringspunkter andras
- Spelarens read-only-vy `/mitt-utvecklingstrad` visar samma aktuella fokus och tranarsammanfattning som den gemensamma utvecklingssidan, men inga privata tranaranteckningar.
- Fraga om att ta bort/flytta pass-/skottstatistik fran spelarniva till lagniva ar medvetet uppskjuten, ror inte utan att anvandaren tar upp det igen


## Webbdesign publicerad 2026-09-09

Efter användarens instruktion publicerades designen på https://bsk2014.se, commit `9eacc854d18f3e0e93b6a2e65dd6d11b41c5dfc7`. GitHub Actions https://github.com/Xoz/bskapp/actions/runs/34344433886 passerade tester, produktionsbygge, datagranskning och hälsokontroller. Aktiv release `/opt/bsk/releases/9eacc854d18f.aedBpv`; backup `/opt/bsk/backups/main-9eacc854d18f.yN4Yzv`.

Inloggad Idag-vy och originalmärke verifierade visuellt i produktion. 67 spelare, 144 matcher och 0 samtal efter publicering, samma antal som före ändringen. Inga verksamhetsuppgifter skrivna under kontrollen. iOS fortsatt pausad.

## 2026-09-09 – Gul och ett samlat webbflöde

Användaren är ensam användare och gammalt innehåll är testdata. Datamigrering
från sidoprodukter och delning mellan tränare prioriteras ned. Ingen data raderad.
Huvudappen ska utgå från Gul.

Implementerat på `feat/gul-unified-navigation`, ännu inte publicerat: fyra
huvudingångar Idag, Spelare, Matcher, Träning; Gul förvalt i spelare/matcher;
uttagningsredigeraren under matchen; nästa steg före/efter match; gamla länkar
omdirigeras. Webbprofilen skapar inte längre parallella manuella mål, befintliga
mål nås i historiken. Trädet och samtal behålls. Träningspass är fortfarande
personliga; faktisk lagkoppling återstår.

Verifierat: 132 tester, typkontroll och produktionsbygge. Lokal webbläsare med
syntetisk Gulmatch: öppna match, välj spelare och spara uttagning; databasen
bekräftar valet. Produktionsdata har inte ändrats.

## Gul-flödet publicerat 2026-09-09

PR #8 publicerad på bsk2014.se, commit `1c14f9255b64b42e3a3c686e4036b7d65b54fac4`.
GitHub Actions: https://github.com/Xoz/bskapp/actions/runs/34355120448 — godkänd.
Aktiv release `/opt/bsk/releases/1c14f9255b64.bvLcVu`; backup
`/opt/bsk/backups/main-1c14f9255b64.okXSFY`.
132 tester, produktionsbygge, datagranskning och hälsokontroller godkända.
Befintlig Chrome-session fungerar. Fyra huvudingångar, Gul-förvald matchlista,
matchens nästa steg och uttagningen under matchen verifierade i produktion.
67 spelare, 144 matcher och 0 träningspass före/efter. Inga testuttagningar
eller andra verksamhetsuppgifter skrivna i produktion vid kontrollen.
Träningspassens faktiska lagkoppling återstår; pass är fortfarande personliga.

## 2026-09-10 – filfri Svenska Lag-tjänst för Gul

Användaren godkände automatisk VPS-synk och förtydligade att filnedladdningar
inte är önskade. Befintlig direktsynk är manuell JSON-inmatning; Excelvägen
är äldre. Den nya arbetaren läser kalender, svar och uttryckligen sparad
närvaro direkt med Playwright. Inga exporter ingår.

Implementerat på `feat/svenskalag-sync`, kodcommit `28f2fba6`: insamlare,
validering, transaktionell import, bevarade uttagningsbeslut, status/kö/historik
i appen och separat systemd-tjänst. 138 tester inklusive tillfälliga DB-tabeller
passerade; Playwright-kontroll med testvyer och produktionsbygge godkända.
Riktiga Svenska Lag-vyer inspekterade via befintlig Chrome-session.

VPS: `/opt/bsk/sync-releases/28f2fba6`, symlink `/opt/bsk/svenskalag-sync`.
Separat användare och databasroll `bsk-sync` respektive `bsk_sync`.
Tjänsten installerad; timern **disabled**. Startkontroll utan session gav
förväntat `login_required` och importerade inga aktiviteter. Webbändringarna
är ännu inte publicerade. En riktig filfri provhämtning och skarp import
återstår innan schemat aktiveras.

Användaren har ombetts logga in i ett separat Chromium-fönster; autentisering
för VPS-arbetaren saknas. Sessionsfilens innehåll får aldrig loggas eller
skrivas i dokumentation. När den finns: överför skyddat till VPS, provkör,
kontrollera kopplingar, kör skarpt och aktivera timern. Se SVENSKALAG_SYNC.md.


## 2026-09-10 – Svenska Lag-synk i drift (ersätter tidigare väntestatus)

Automatisk inloggning och filfri hämtning är verifierade. Huvudappen publicerad
via PR #9, commit `6f0b6ace146f4f35c2e563ac20dd7dfe099eb09d`, godkänd körning
https://github.com/Xoz/bskapp/actions/runs/34517570292.
Arbetare `/opt/bsk/sync-releases/0b48e23f`; timern är enabled/active.
Första skarpa synken klar 2026-09-10 21:04 Stockholm: 45 kalenderposter lästa
för 13 augusti–24 september, 23 uppdaterade (9 matcher, 14 träningar), 22 lämnade
orörda. 18 matchposter saknar koppling: 16 den 15–16 augusti, Hammarby 6 september
och Värtan 20 september. Fyra träningar (17, 18, 19 och 31 augusti) har olöst
spelarkoppling. Preliminära final-/bronsmatcher ingår i kalenderantalet; 45 är
inte ett antal säkert genomförda aktiviteter. Dessa kopplingar återstår.
67 spelare, 144 matcher och 0 träningsplaner efter synk; uttagningarnas checksumma
oförändrad. 14 träningsaktiviteter har källan svenskalag_browser.
138 lokala tester inklusive DB-integration godkända; 137 + 1 överhoppat i CI.
Produktionsbygge, datagranskning och hälsokontroller godkända.
Aktiv huvudrelease `/opt/bsk/releases/6f0b6ace146f.KvECoy`; backup före import
`/opt/bsk/backups/main-6f0b6ace146f.8eOL7p`.
Inloggningsuppgifter finns endast i privat VPS-miljöfil, inga värden i dokumentation.


## 2026-09-10 – tvåvägssynk publicerad

Huvudapp: PR #10, commit `13eef7232d06585d92bd4449d216d1b60ac6d0ce`.
GitHub Actions https://github.com/Xoz/bskapp/actions/runs/34520670229 godkänd.
Release `/opt/bsk/releases/13eef7232d06.aE56jI`; backup före import
`/opt/bsk/backups/main-13eef7232d06.e3IFii/bsk.dump`.
Migration 0022 (matches.cancelled) och begränsade DB-rättigheter verifierade.

Aktiv arbetare `/opt/bsk/sync-releases/e9b054d5`, via `/opt/bsk/svenskalag-sync`.
Den använder oförändrade beroenden via node_modules i release 860d763c, som ska
behållas tills beroendena installeras fristående vid nästa uppgradering.
Workerfixar 76a05da4/f02ad5f9/3ac48260/e9b054d5 är separat publicerade efter lokal verifiering;
webbpaketet är fortfarande 13eef723. Timern är enabled/active, körkö avläses varje
minut och ordinarie inläsning cirka varje timme 06–22 samt 03, svensk tid.

Skarp masterinläsning 21:34–21:35 Stockholm: 45 aktiviteter (27 matcher, 18 träningar),
18 nya matcher; matchantal 144 → 162, spelare oförändrat 67. Fem framtida
laguppställningar hämtade. AIK-matchens åtta spelare visas i appen, separat från
tio ja-svar. Fyra historiska träningar har kvar några olösta spelarnamn (17,18,19,31
augusti), men aktivitet, totaler och kända spelare uppdateras.

Första försöket nådde 1 GB-gränsen och avbröts före transaktionscommit. Åtgärdat:
en ny sida per aktivitet, inga bilder/media/typsnitt, ingen bakåtcachning och
begränsat antal renderprocesser. Lyckad körning nådde ca 402 MiB; tak 1536 MiB.
Vid första spegling av tomma tidigare manuella rader ändrades sex ägarmarkeringar
för AIK-matchen till Svenska Lag. Backupkontrollen visade noll manuellt uttagna
före synk och bevarade positioner; ingen tidigare uttagning togs bort.

141 tester inklusive Postgres-integration, typkontroll, produktionsbygge och två
Playwright-prov godkända. Riktiga Svenska Lag-redigeraren verifierad fram till
sparsteget med tillägg/borttagning, utan externa ändringar. Produktionsvyn visar
Spara utkast, Skicka till Svenska Lag och länk till kallelser. Hela köflödet provat i produktion 21:45: appknapp → beständig kö → arbetare →
Svenska Lag-kontroll → synligt lyckat kvitto. Uppställningen var identisk med
källan och krävde därför ingen skrivning till Svenska Lag. Inga kallelser skickades.
Testet fångade och löste äldre iCal-id:n: utgående mål kopplas nu via den kanoniska
utvecklingsaktivitetens Svenska Lag-id. Skarp skrivning av en ändrad uppställning
är ännu inte utförd; den ändrande skrivvägen är verifierad i Playwright-testmiljö.

Svenska Lag är master för matchuppgifter, svar och registrerad närvaro; appen äger
utkast tills publicering. Kallelser skickas i Svenska Lag. Positions-/formations-
överföring, permanenta person-id:n och full avstämning av borttagna poster utanför
kalenderfönstret ingår inte ännu. Ingen atomisk versionskontroll finns på källans
spara-adress; en liten samtidighetsrisk mellan sista kontroll och sparande kvarstår.


## Matchkontroll publicerad 2026-09-10

Huvudappen är publicerad från `3ffc3b8c2bafd1a85024e34ec0541cd61f59ac6d`:
https://github.com/Xoz/bskapp/actions/runs/34525351050 (godkänd).
Synkarbetaren är `d4c74436`; full körning 22.10 svensk tid gav 45 aktiviteter och
66 kontrollerade importerade Gulposter, med tre bekräftade borttagningar.
Hammarby 12 september, Vaxholm 30 augusti och gamla Värtan 29 augusti är inaktiva.
Idag och Matcher döljer dem; direktlänken till Hammarby anger borttagen i Svenska Lag.
Idag verifierad i publicerad app: AIK 12 september 09.00 och Örby 16.30, båda med
10 kallade/10 ja, separat från uttagna 8 respektive 6. Kallelsernas läskälla är nu
korrekt även i aktivitetslistan och aktivitetsdetaljen. 143 tester, typkontroll,
produktionsbygge, Playwright-kontroll och publiceringskontroll godkända.
Kompletterande kalenderkontroll av 40 importerade Gulposter från 2025 gav inga
borttagnings- eller datum-/tidsavvikelser. Historiska cupgrupper, cupaktiviteter och
manuella poster återstår att normalisera. Grön är inte inventerat på samma sätt.
Se `docs/MATCH_AUDIT_2026-09-10.md` för resultat och avgränsningar.


## 2026-09-10 – AIK: ja-svar tydligt skilda från laguppställning

Direktkontroll i Svenska Lag gav 10 spelare + 1 ledare som tackat ja till AIK 12 september. Appens källtotal och 10 spelarposter stämmer; 8 avser laguppställningen. Användaren uppfattade startsidans ”8 uttagna”/”8 klara” som fel antal ja. Publicerad rättning `47e44428` visar ”10 har tackat ja i Svenska Lag” främst på Idag och i uttagningsvyn; 8 markerade i laguppställningen visas separat. Varningar anger uttryckligen uppställning respektive ja-svar. Inga val, svar eller kallelser ändrades. Typkontroll, produktionsbygge och inloggad kontroll av båda vyerna godkända. Publicering: https://github.com/Xoz/bskapp/actions/runs/34525751849.


## 2026-09-10 – permanent gemensam matchlogik

På användarens begäran är reglerna nu samlade för befintliga och nya matcher, utan AIK-specifik logik. `activityCallups.ts` delar källräkningen mellan aktivitetssidor, webbens uttagningslista och mobilens match-/uttagningslistor. NULL-total får fallback till match_roster, medan noll behålls som källvärde. Den redundanta överskrivningen i getSelectionWorkspace är borttagen.

`selectionDraftStatements` används av webb och mobil. Äldre trupp-/cupformulär använder samma skydd genom `selectionDraftGuardStatements`. Ja-svar auto-väljer aldrig spelare. Alla utkast, även tomma, skyddas mot synk. Inkommande synk tar matchlåsen i id-ordning före verksamhetsskrivning; browserläsningen sker före transaktionen. Kallelser och faktisk närvaro ändras inte av spelarval. Mobilens listor döljer inaktiva matcher.

Webb/server publicerat från `3e1279e655fa6384bff9cfce4a31f5744b666955`, godkänd körning https://github.com/Xoz/bskapp/actions/runs/34527033441. Synkarbetare `a7ca6f69` körde klart 22.32 svensk tid: 45 aktiviteter, 66 Gulposter granskade, samma tre bekräftade borttagningar och fyra sedan tidigare delvis okopplade träningsaktiviteter. Efter synk: AIK 10 ja/8 i uppställningen, Örby 10 ja/6 i uppställningen. Bekräftat i databasen, publicerad webb och produktionsserverns mobila läsmodeller.

146 tester passerade: flera matcher, noll/saknad källtotal, svar som ändras utan ändrade spelarval, tomt utkast över synk, separata närvarorader samt kompletta mobila SQL-frågor. Typkontroll och webbbygge godkända. iOS-klientens låsta spelarval och otydliga etiketter är rättade och simulatorbygget lyckades; en ny iOS-installation är inte utförd och krävs för klientändringarna. Serverrättningen gäller redan.

## Bemanningsvarning 2026-09-10

Veckans matchkort bedömer spelarbrist enbart från Svenska Lags ja-svar, aldrig
från antal markerade i laguppställningen. Befintlig gräns är nio ja; tio ja ger
alltså ingen varning även med sex eller åtta markerade. Inga registrerade
kallelsesvar ger ingen bristvarning. Uttagningen visas fortsatt separat.

Verifierat och publicerat som ff65de3a: typkontroll, sex renderingsfall och godkänd VPS-deploy. Produktionskontroll av Idag visar AIK och Örby utan bristvarning med tio ja vardera.

## Matchtruppens status och sortering 2026-09-10

Uttagen och Kallad visas som oberoende markeringar i SelectionEditor, med ja/nej/inväntar i svarskolumnen. Spelare som varken är markerade i aktuellt utkast eller har kallelsestatus sorteras efter alla spelare med status, även över laggränser. Position och namn behåller ordningen inom grupperna. Sorteringen följer ändringar i uttagningen och gäller även lagfilter.

Verifierat i produktion e70e64b5: AIK-listan visar alla elva spelare med uttagning/kallelse före Ava. Uttagen + Kallad visas tillsammans där båda gäller. Typkontroll, renderingskontroll med ja/nej/inväntar och VPS-publicering godkända.

## Matchnärvaro 2026-09-10

Orsak till noll spelade matcher: collect letade bara efter ”Fyll i närvaro”.
Matcher använder ”Fyll i laguppställning” och en `.memberlist.match` utan
träningens gruppflikar. Båda varianterna stöds nu, fortsatt endast med uttrycklig
markör för sparad närvaro och kontroll av komplett antal inklusive ledare.
Spelarlistan utesluter ledare; ja-svar används inte som spelad match.
Playwright-fixturer verifierar båda sidvarianterna och avvisar ofullständiga svar.

## Förenklad Idag 2026-09-10

Idag visar veckans Gulmatcher en gång i en sammanhållen kolumn och behåller
matchutrymme som utfällbar fördjupning. Dubblerad nästa-match-yta, truppuppgifter
och veckosiffror är borttagna. Spelarutveckling och samtal nås under Spelare.
Väntande spelarbedömningar efter match flyttas till en utfällbar sektion på
Spelare (Gul/alla), med befintlig behörighetskontroll och länkar till utvärdering.

## Spelarlistans kallelser – rättning 2026-09-10

Spelarlistan använder nu match_roster med accepted/declined/pending i stället för den äldre aktivitetsimportens kallelser. Både registrerade spelade matcher och matchkallelser avgränsas till aktuellt kalenderår och valt lag inklusive underordnade cupgrupper. Inställda/borttagna matcher exkluderas. Alla/Ej tilldelat visar spelarens samtliga lag och även matcher utan lagkoppling, uttryckligen märkt i vyn. Kallelser inkluderar framtida matcher under året; spelade matcher gäller fram till idag. Importhistoriken kan vara ofullständig. Befintliga andra spelarprofilsräknare ändras inte i denna avgränsade rättning. PostgreSQL-regressionstest och källelsetest godkända, typkontroll godkänd. Lokalt ändrat; inte publicerat i denna session.

Slutkontroll: produktionsbygge godkänt med lokal bskdev-databas. Ingen produktionspublicering gjord.

Publicerat och verifierat 2026-09-10 som 6569704f: Idag visar AIK och Örby en gång vardera samt utfällbart matchutrymme. Spelare visar tre väntande matchbedömningar i utfällbar sektion. Typkontroll, uppdaterade kontrakttester och releasekontroller godkända.

## Publicerad spelarstatistik – 2026-09-10

Rättningen är publicerad på https://bsk2014.se/spelare, commit bc1f88a0b3a685892d317da6ba968fe1d980df5f. GitHub Actions https://github.com/Xoz/bskapp/actions/runs/34530853762 godkänd; aktiv release /opt/bsk/releases/bc1f88a0b3a6.MjP2TU. Alla 147 lokala tester godkända. Publiceringen genomförde backup, tester, bygge och hälsokontroller. Inloggad spelarlista verifierad med år 2026, Gul inklusive cupgrupper, och nya räknare för spelade matcher/matchkallelser. Detta ersätter tidigare anteckning om att rättningen inte publicerats.

## Matchplan: formation och spelidé – 2026-09-10

Matchdetaljens dubbla uttagningsknappar ersätts av Matchplan och en separat länk till Trupputtagning. Matchplanen har fyra formationer för 7 mot 7, flyttbara positioner (pekare eller tangentbord), tilldelning från uttagen trupp, avbytare och fritext för fokus, anfall, försvar och omställningar. Sparas separat per match i settings med nyckeln match_plan:<id>. Ändrar inte match_roster, kallelsesvar, närvaro, gamla lineup-positioner eller Svenska Lag. Ingen migration. Sparandet kontrollerar behörighet, lagåtkomst, matchstatus och aktuella uttagna spelare samt skyddar mot överskrivning av nyare revisioner. Identiska återförsök är idempotenta.

Verifierat lokalt: 152 tester, produktionsbygge och inloggat browserprov med exempelspelare; formation, spelare, text och flyttad position sparades och återlästes. Matchplanen är inte publicerad i denna session.

Matchplanens design förfinad: skalbara matchtröjor i klubbfärger, separat målvaktströja, lediga positioner som konturer, korta namnbrickor med fullständiga tillgängliga namn, klickbara avbytare och bredare matchyta. Inloggat lokalt prov verifierade avbytarplacering och sparande. Publicering begärd.

## Matchplan och design publicerad – 2026-09-10

Publicerad commit 16ebe45b2ab8f3926dfca76b5d765e9890d8fcbb. GitHub Actions https://github.com/Xoz/bskapp/actions/runs/34532385619 godkänd. 152 lokala tester och produktionsbygge godkända. Inloggad AIK-match på https://bsk2014.se/matcher/7 verifierad med ny matchplan, fyra formationer, klubbtröjor, separat målvaktsfärg, lediga positioner, klickbara avbytare och spelidépanel. Ljust läge kontrollerat lokalt och mörkt läge i produktion. Placering från avbytarlistan och sparande provat endast med lokala exempelspelare. Inga riktiga matchplaner eller uttagningar ändrades vid kontrollen. Tidigare anteckning om ej publicerad matchplan är ersatt.

## Matchplanens spelarurval rättat 2026-09-10

Både visning och sparande tillåter nu ja-svar (accepted) samt redan uttagna spelare. Tidigare krävdes selected även för ja-svar. Inga kallelser eller uttagningar ändras när matchplanen sparas. Rubriken är Spelare att placera. 153 tester och produktionsbygge godkända; databastest verifierar ja utan uttagning och oförändrad match_roster.

## Ja-svar i matchplan publicerat – 2026-09-10

Commit 7451bdef88adb0f666c03e0e646112c213eb5606 publicerad, godkänd körning https://github.com/Xoz/bskapp/actions/runs/34532750201. Formationsverktygets visning och sparande använder samma urval: accepted ELLER selected i match_roster. Inloggad AIK-match verifierad: 11 tillgängliga i matchplanen, befintlig uttagning fortsatt 8. Rubriken är Spelare att placera. 153 tester och bygge godkända. Matchplanstest verifierar ja utan uttagning, nekade övriga spelare och oförändrade kallelser/uttagning. Inga verksamhetsuppgifter ändrades under produktionskontrollen.

## Korrigerat beslut: endast ja-svar i matchplanen

2026-09-10: användaren klargjorde att tidigare uttagning inte får inkludera en spelare som tackat nej. Matchplanens gemensamma urval och sparvalidering använder därför enbart callup_status=accepted. Tidigare OR selected-regel är ersatt. Kallelser och laguppställning ändras inte. Regressionstest nekar uttryckligen selected + declined.

## Endast ja-svar publicerat – 2026-09-10

Commit 09449e2658de70dc9432bd0cd6b06309bce46441 publicerad, godkänd körning https://github.com/Xoz/bskapp/actions/runs/34533040176. Matchplanens urval och sparvalidering använder endast accepted. Tidigare OR selected är borttaget. Inloggad AIK-match verifierad: 10 valbara ja-svarande spelare, spelare med nej-svar saknas i formationsvalet. Befintlig laguppställning och kallelsesvar är orörda. 153 tester och bygge godkända.

## Gemensamt språk i hela appen (beslut 2026-09-10)

- **Trupp** = alla som tackat ja och kommer att spela matchen (`callup_status=accepted`).
- **Laguppställning / Uttagen** = planerad att spela, kallelse skickad eller kommer att skickas (`selection_status=selected`). Uttagning är inte ett ja-svar.
- **Deltog / Deltagare** = faktisk registrerad närvaro efter matchen.
- **Spelare / Spelarregister / Huvudlag** = hela spelarbasen eller organisationen; använd inte trupp för dessa.

Definitionerna gäller alla vyer, räknare, hjälptexter, guide och API-etiketter. Ändra aldrig kallelsesvar eller uttagning bara för att anpassa terminologin. Interna befintliga databasfält och URL:er kan behålla sina namn.

## Gemensam terminologi publicerad – 2026-09-10

Commit 1e65ca1fb35224b989ec751fce5c0dfd71bd4d0f publicerad i webbappen, godkänd körning https://github.com/Xoz/bskapp/actions/runs/34533538172. Trupp=ja-svarande; laguppställning/uttagen=planerad; deltog=faktisk närvaro; spelarregister=hela spelarbasen. Matchvyer, uttagning, cup, register, inställningar, guide och API-etiketter är anpassade. AIK verifierad inloggat med separat trupp (10) och laguppställning (8). 153 tester, webbbygge och syntaxkontroll av fyra ändrade Swift-filer godkända. Äldre nativekällans texter uppdaterade; ingen ny nativeapp har distribuerats. Inga kallelser, uttagningar eller närvaroposter ändrade av terminologiarbetet. Definitioner fastställda i AGENTS.md.

Matchplan 2026-09-10: den separata rutan för position/spelarval/återställning är borttagen enligt användaren. Placering sker via plan + kompakta spelarknappar med kortnamn (fullständigt namn tillgängligt). Vald placerad spelare kan tas av planen via en liten textknapp.

## Kompakt placering publicerad – 2026-09-10

Commit e393ef2696bee5b37c06707f059e4c0659e82505 publicerad, godkänd körning https://github.com/Xoz/bskapp/actions/runs/34533764459. Positionens stora ruta med dropdown/återställning borttagen. Spelare att placera visas som mindre knappar med små tröjor och kortnamn; fullständiga namn finns kvar för tillgänglighet. Liten textknapp kan ta vald spelare av planen. Typkontroll och publiceringskontroller godkända, inloggad visuell kontroll av AIK-matchen godkänd. Inga matchplaner eller verksamhetsuppgifter ändrade vid produktionskontrollen.

## Individuellt matchutrymme – 2026-09-11

Användaren har godkänt batterimodell för kallelse/lån, med individuell kapacitet
(standard 100, justerbar 50–150) och gemensam återhämtning. Webbens Idag,
spelarprofil och matchuttagning använder tidsbaserad prognos. Alla kommande
matcher har en separat jämförelsevy med före/efter och osparad speltidssimulering.
Gröns matcher ingår även när de inte visas i Guls lista. Grön-synken är aktiverad
och första importen verifierad. Se docs/MATCH_SPACE.md för antaganden och drift.
Webbpublicering är verifierad; se publiceringsnoteringen nedan.

## Matchutrymme publicerat och verifierat – 2026-09-11

Webbcommit f9178c93a9539e332fc61f8350fe088f3633de72 är publicerad på bsk2014.se.
Godkänd körning: https://github.com/Xoz/bskapp/actions/runs/34536413292.
168 tester med PostgreSQL-integration och produktionsbygge godkända i isolerad
arbetskopia. Inloggad produktionskontroll av Idag, AIK:s matchutrymme och
kapacitetsfältet på spelarprofilen godkänd. Inga verkliga kapaciteter, kallelser
eller uttagningar ändrades vid UI-kontrollen; sparande provades med lokala
exempelspelare och dessa testposter är borttagna.

Gröns bakgrundssynk är aktiv och senaste skarpa körning lyckades. 16 matcher
importerade, nio med sparad närvaro; ett registrerat Ella-deltagande hos Grön
hittat. Inga dubbla stabila käll-id:n i Grön. Aktivitet 20028813 har en olöst
spelarkoppling och ger därför underlagsvarning. Den ersätter inte bekräftade
deltaganden med antaganden. Guls startsida visar fortsatt endast Gulmatcher.

## Jämnt delad speltid i batteriet – 2026-09-11

Beslut: utespelarna delar lika på 6 × 60 minuter i 7v7 och 8 × 75 minuter i 9v9, med en målvakt som får full matchtid. Batteriet räknar om historik och prognos från hela matchens deltagarantal. 75 minuters matchlängd identifierar 9v9 tills separat spelform finns; kortare cupmatcher behåller sin längd. Målvaktsposition prioriteras från matchunderlag, annars profil; saknad/tvetydig målvakt ger varning. Statistikminuter och Svenska Lag ändras inte. 178 tester med PostgreSQL och produktionsbygge godkända lokalt. Se docs/MATCH_SPACE.md.

## Jämn speltid publicerad och verifierad – 2026-09-11

Webbcommit 0b365318ef7074a2dfa10b3c40497c2cfd4655d9 publicerad.
Godkänd körning: https://github.com/Xoz/bskapp/actions/runs/34564418443.
178 tester med PostgreSQL och produktionsbygge godkända. Inloggad kontroll:
Adele 100/100 nu; AIK-matchens tio ja-svarande ger Adele 40 minuter och
80/100 efter matchen, Emma 60 minuter som målvakt. Uttagen utan ja räknas som
eget hypotetiskt tillägg och minskar inte speltiden för de ja-svarande.
Historik och prognos använder den nya fördelningen, inklusive Grön.
Appen visar underlagsvarning vid saknad/tvetydig målvakt. 75 minuters
registrerad matchlängd identifierar 9v9 tills ett separat spelformsfält finns.
Ingen ändring av närvaro, statistikminuter, kapacitet eller kallelser gjordes
vid verifieringen. Tillfällig lokal testdatabas borttagen.

## Synk av Sanktan/träningsmatch och spelform – 2026-09-11

Användaren godkänner genomförande inom Sanktan och träningsmatcher. Collector läser tävlingslänkens stabila id/namn och explicit 7v7/9v9 i namn eller matchbeskrivning. Fem verifierade Sanktan-id:n för Gul/Grön 2026 stöds; nya/okända tävlingar och motstridig spelform flaggas och lämnas orörda. Träningsmatch identifieras från tävlingsnamnet. Utan explicit spelform används lagets standard 7v7, märkt default. Matchtyp och 3 × 20/25 min uppdateras på befintliga match-id:n enligt användarens 60/75-minutersregel. Tävlingsmetadata sparas i settings och batteriet använder explicit format före äldre längdfallback.

Identifierade cuper hoppas över helt i denna hämtning: ingen historisk cupimport eller cupklassificering. Befintliga cupdata raderas inte. Namn med Cup/Cupen prioriteras före Friendly/träningsmatch. Okända namn får aldrig automatiskt Sanktan. Ordinarie synkfönster −28/+14 dagar kvarstår; ingen bred säsongsimport. Verifiering: 183 tester med PostgreSQL, Playwright-fixturer för båda lagen och produktionsbygge godkända. Skarp provhämtning och driftsättning verifieras separat.

## Matchtyp och spelform publicerade och verifierade – 2026-09-11

Webbcommit ac1bbafb5fc6f6f841b1130423b267219ebd439c publicerad, godkänd körning https://github.com/Xoz/bskapp/actions/runs/34566095318. Synkarbetaren kör 630345ca i /opt/bsk/sync-releases/match-types-20260911; tidigare /opt/bsk/sync-releases/match-space-20260911 behålls inklusive dess node_modules som den nya releasen länkar till. Timern är aktiv. Återgång av worker: återställ symlänken till föregående release; nya metadata/rättad matchtyp bevaras.

Skarp synk klar 07.27 Stockholm: Gul 29 aktiviteter, 16 cupmatcher överhoppade, noll okända tävlingar eller olösta namn. Grön 16 matcher, tidigare olöst spelarkoppling i aktivitet 20028813 kvar. Hammarby 6/9, app-id 211, behåller id och är nu traningsmatch, explicit format 9, 3 × 25 min. AIK id 7 är fortsatt seriespel, format 7 (lagets default), 3 × 20 min. Cupmatch id 196 är oförändrad och har ingen ny metadata. Inloggad Hammarbysida visar Träningsmatch · 9 mot 9 · 75 min (3 × 25). Sjumannaformuläret visas inte på verifierade niomannamatcher; formationsplanering för 9v9 är ännu inte byggd.

183 tester med PostgreSQL, Playwright-källfixturer, produktionsbygge, skarp provhämtning och produktionskontroll godkända. Tillfällig lokal testdatabas borttagen. Cupplanen är fortsatt separat, ingen historisk cupimport/rättning utförd. Nuvarande batteri kan fortfarande innehålla redan befintliga historiska cupuppgifter; dessa har inte raderats eller omklassats av denna leverans.

## 2026-09-11 – matchplanens sparande över publiceringar

AIK-användarens sparfel spårat till serverloggen 07.33 Stockholm: action-id 7031be… hörde till saveMatchPlan i föregående release 630345ca, men aktuell release var ac1bbafb. MatchPlanEditor använder nu en fast POST /api/matches/[id]/plan via lib/matchPlan/client.ts. Befintlig serverfunktion behåller behörighet, gruppåtkomst, ja-svar och atomiskt revisionsskydd. API kräver samma origin (proxy via requestOrigin) och JSON. Klienten kräver korrekt nästa revision innan sparbekräftelse; fel behåller aktuell uppställning. Inga verksamhetsdata ändras av driftsättningen. Redan öppna gamla klienter måste laddas om en gång; deras osparade uppställning finns endast i den öppna sidan och får inte utlovas återställd automatiskt.

## 2026-09-11 – kompakt sparad matchplan

Sparad matchplan öppnas som kompakt läsvy: mindre statisk plan, formation, avbytare och spelidé som text utan formulär. Redigera öppnar befintlig editor; lyckat sparande återgår till översikten. Avbryt återställer senaste sparade plan. Osparade nya planer öppnas direkt för redigering. Inga ändringar av matchdata eller spartransport.
