# BSK App - Project Context

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

## 2026-09-10 – BSK-frågor via privata Hermes

En fristående lokal MCP-process är driftsatt på samma VPS och ansluten till
privata Photon/iMessage-profilen. Sex läsverktyg hämtar lagets spelare, matcher,
utvecklingsbild, avgränsad träningsnärvaro och kontots egna träningspass.
Installationen är uttryckligen låst till konto 1 och Gul; särskild databasroll
har bara SELECT på skyddade vyer. Inga skrivverktyg, publika portar, Next-routes
eller appreleaser. Nio DB-/MCP-integrationstester och verkliga verktygsanrop
passerade. En vanlig Hermes-fråga gav korrekt nästa match med BSK-länk.
Närvaron gäller endast den nya lagkopplade Svenska Lag-webbsynken, med redovisad
täckning och okänd närvaro. Äldre oskopade importer ingår inte.

En SDK v2-kompatibilitetsrättning i Hermes behövdes för read-only-märkning;
alla tolv trust-tester passerade utan ändrad policy. Privat gateway är aktiv,
Photon ansluten, Discordprofilen oförändrad. Drift, begränsningar och
återställning: `integrations/hermes-bsk/README.md`.


### 2026-09-10 – kallelsesvar i Hermes

`integrations/hermes-bsk/callups.sql` lägger till lagavgränsade aktivitets- och
kallelsevyer. `server.py` har nu `aktiviteter` och `kallelsesvar`: matcher och
träningar, ja/nej/obesvarat samt separat uttagen matchtrupp. Gäster i den
behöriga aktiviteten ingår utan åtkomst till deras privata profil. Källtotaler,
namntäckning och radändringstid redovisas. Tolv isolerade tester passerade;
stdio och Hermes-dispatch verifierade mot produktion. Ingen verksamhetsdata
ändrad av integrationen. Se integrationsguiden för drift och återställning.
