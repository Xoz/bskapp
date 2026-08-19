# BSK App - Project Context

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
