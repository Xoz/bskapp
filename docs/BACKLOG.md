# Backlog

## Gällande beslut 2026-09-10: enbart webbapp

Native/iOS ingår inte längre i produkten eller den aktiva planen. All fortsatt
utveckling och verifiering gäller bsk2014.se i webbläsaren på mobil, iPad och dator.
Äldre nativebeslut nedan är historik. Befintlig nativekod lämnas tills vidare;
installation, simulatorbyggen och nativeparitet är inga leveranskrav.
Svenska Lag är fortsatt master för matcher, kallelser, svar och närvaro.


Samlade öppna punkter. Detaljerade specar bor i egna filer – den här listan är en
överblick över vad som väntar och var det är dokumenterat.

## Publicerat 2026-09-10: tvåvägssynk med Svenska Lag som master

Spara utkast → Skicka till Svenska Lag → laguppställning; kallelser skickas där.
Nya matcher, svar, registrerad närvaro och inställd status speglas tillbaka.
45 aktiviteter uppdaterade, 18 matchkopplingar lösta genom källstyrt skapande.
Fyra äldre träningar har några olösta spelarnamn. Återstår: permanenta person-id:n,
positioner/formation och full avstämning av borttagna kalenderposter. Se
`SVENSKALAG_SYNC.md` för drift och verifieringsgränser. PR #10 är publicerad.

## Aktuellt efter publiceringarna 2026-09-09

Denna sammanställning har företräde framför äldre pilotstatus nedan. Målet är en
samlad huvudapp på bsk2014.se. Observation är inte ett obligatoriskt förstasteg.

Publicerat: spelarträd → fokus → samtalsunderlag/historik, ny webbdesign och
träningsbyggare med originalritaren samt 15 mallövningar. Se
`UNIFIED_PLAYER_FLOW.md`, `TRAINING_BUILDER.md` och `MAIN_RELEASE.md`.

Beslut 2026-09-09: användaren är ensam användare och tidigare innehåll är testdata.
Historisk datamigrering och delning mellan tränare är inte kritiska och pausas.
Gul är utgångspunkt; ingen generell dataradering ingår i beslutet.

Aktuell arbetsordning:

1. **Sammanhållet webbflöde – publicerat 2026-09-09.**
   Fyra ingångar: Idag–Spelare–Matcher–Träning. Gul är förvalt i spelare och
   matcher. Uttagning ligger under matchen, gamla länkar leder dit.
   Matchen visar nästa steg före/efter match. Manuella mål kan inte längre
   skapas från webbprofilen; befintliga mål ligger under historik.
   Trädfokus och samtalsflödet är kvar. 132 tester, typkontroll och bygge godkända;
   lokal webbläsarkontroll inklusive sparad testuttagning genomförd.
   Produktionsnavigation, Gulfilter och match → uttagning verifierade.
2. **Verifiera vardagsanvändningen med Gul.** Ett verkligt spelar-/samtalsflöde
   och ett helt lagpass på mobil/iPad-webb, återöppning och nätavbrott.
   Checkin-formulärets återförsök och serverutkast för samtal återstår.
3. **Träningens lagkoppling.** Pass är fortfarande personliga. Koppling till Gul
   och träningsaktivitet samt genomförandeläge återstår. Delning mellan flera
   tränare kan vänta tills det behövs.
4. **Avveckla sidoprodukterna.** Kontrollera kvarvarande funktionsbehov och
   länkar och stäng sedan gamla skrivvägar/tjänster. Ingen omfattande migrering
   av testdata ska prioriteras före vardagsflödet.

Kända datavarningar från senaste release: 9 aktiva spelare utan primär grupp
samt en skillnad mellan målhändelser och matchresultat. Kräver separat kontroll;
inte automatiska korrigeringar. Vercel Preview saknar ännu en egen databas;
aktuell backupdrift ska kontrolleras mot faktiska tjänster, inte äldre påståenden.

Native/iOS är avslutad som produktinriktning enligt beslutet ovan. Utskrift behövs inte.
Generativ AI/Graphiti är inte prioriterade. Äldre observationskvoter nedan är
historik från tidigare produktinriktning och ska inte återinföras som aktuella krav.

## Äldre backlog och granskningshistorik

### Produktomstart – fyraveckorspilot

- **Fas 1–3 tekniskt klara 2026-08-18.** En kanonisk utvecklingskärna speglar
  Svenska Lag-/matchreferenser och lagrar högst två aktiva mål, målkopplade
  observationer, deltagande/exponering och tränarens uttagningsbeslut. De fyra
  primärvyerna är Idag, Observera, Spelare och Uttagning. Uttagningsstödet visar
  förklarbara möjligheter och balansvarningar utan poäng, ranking eller automatval.
- **Fas 4 pågår i verklig användning.** Appen mäter målgrad, observerade
  aktiviteter, sparade uttagningar och registreringstid för de senaste 28
  dagarna. En faktisk fyraveckorspilot med tränarna måste genomföras innan
  kärnloopen kan godkännas. Mål: minst 80 % av spelarna med aktivt mål, minst
  75 % av aktiviteterna observerade och observationer normalt sparade på högst
  två minuter. Samla kvalitativ feedback om uttagningsunderlaget efter varje match.

### Cupberedskap – kvar från kodgranskning

- ~~**[Hög] Live-status ändrar matchen vid läsning**~~ – **KLART 2026-06-25.**
  Det tidsbaserade auto-avslutet i `getLiveState()` är borttaget; en publik
  läsning (publikvy/API-poll) kan inte längre stänga en pågående match. Match
  avslutas nu enbart via tränarens explicita "Avsluta match" (`finishMatch()`).
  (`lib/live.ts`)

- ~~**[Medel] Offlinehändelser saknar idempotensnyckel**~~ – **KLART 2026-06-25.**
  Klientgenererad UUID per räknande mutation (`event`/`opponent_goal`/`sub`) +
  unika index `idx_match_events_idem`/`idx_match_subs_idem` på
  `(match_id, idempotency_key)`. `recordEvent`/`recordSub` skippar dubbletter;
  unikt index är backstop vid sann samtidighet. Verifierat i
  `scripts/test-live.sh` inklusive steg O och P (36/36). (`components/LiveTracker.tsx`,
  `lib/live.ts`, `lib/db.ts`)

### Övriga granskningsfynd

- ~~**Testskydd**~~ – **KLART FÖR NUVARANDE MVP.** Huvudappen har 10 gröna
  Vitest-tester för roller, permissions, grupp-/spelarscope och
  säkerhetskontrakt. Liveprotokollet verifierar 36/36 steg inklusive capability,
  coach/förälder, atomisk rate-limit, ångra, offline-replay och två samtidiga
  rapportörer. `coach-platform` har 13 Vitest-tester och tre gröna
  Playwright-flöden, inklusive spelarutdrag, begränsning och permanent radering.

- **GDPR – föreningsbeslut kvar.** Appen lagrar personuppgifter om **minderåriga** (spelare 11–12 år):
  namn, bedömningar/betyg, självskattningar, närvaro m.m. Behöver gås igenom:
  rättslig grund/samtycke (vårdnadshavare), lagringstid & gallring, rätt till
  radering/utdrag och åtkomstloggning. Frågan: vad behöver vi göra för att vara
  GDPR-kompatibla, och vad är minsta rimliga steg? Befintlig
  [SPEC-samtycke.md](SPEC-samtycke.md) behöver revideras: RF anger att
  medlemsbehandling normalt grundas på avtal, så samtycke får inte kodas som
  universell rättslig grund innan föreningen beslutat ändamål och grund för
  just utvecklingsbedömningar.
  Tekniskt finns nu versionsmärkta spelarutdrag, separat avaktivering/begränsning
  och namnverifierad permanent radering i båda apparna. Åtgärderna scope- och
  behörighetskontrolleras samt auditloggas utan barnets namn. Coachdatabasens
  återställningsprov är grönt mot 27 tabeller. Kvar före verkliga barnuppgifter:
  protokollför ändamål/rättslig grund/lagringstid, fyll i
  [DRIFT-OCH-BITRADEN.md](DRIFT-OCH-BITRADEN.md) och bygg gallring först efter
  fastställd retentiontabell. Skadefältet är stängt genom dataminimering:
  Planlinjen samlar inte längre in `injured`/hälsostatus och migrerar äldre
  pilotvärden till vanlig frånvaro.

- ~~**Matchutvärdering**~~ – **KLART.** Två snabba val per spelare, nivåögonblick,
  spelartrend och separata publika bedömarlänkar. Den oanvända ELO-prototypen och
  statistikbaserade betygsförslag är borttagna. Se [SPEC-matchbetyg.md](SPEC-matchbetyg.md).

- **Staging** – koden klar, manuella engångssteg kvar (Vercel-env, Google-redirect).
  `STAGING.md` är uppdaterad för Supabase/Postgres. Kvarvarande steg kräver ett
  separat Supabase-projekt, Preview-hemligheter och Google-redirect i de externa
  tjänsterna. Se [STAGING.md](STAGING.md).

### Externa produktionsgrindar

- Skapa separat Supabase-staging, sätt Vercel Preview-hemligheter och registrera
  Google OAuth-redirect. Kräver konto-/budgetbeslut utanför repot.
- ~~Driftsätt BSK/VPS-bryggan och skydda coach-plattformen~~ – **KLART
  2026-08-10.** Deployworkflowen bygger och migrerar nu båda apparna, håller
  samma bridge-hemlighet i båda root-skyddade env-filerna och tar bort den
  utfasade `ANTHROPIC_API_KEY`. `https://bsk2014.se/coach/` använder strippande
  nginx-`auth_request`; den tidigare öppna `https://klvr.se/coach/` omdirigeras
  dit. Actions `31381324085` och en extern HTTP-kontroll verifierade grinden.
- ~~Rensa utfasade AI-/Turso-hemligheter och felaktiga Vercel-prodbyggen~~ –
  **KLART 2026-08-10.** Vercel innehåller inte längre Anthropic-, Moonshot-
  eller Turso-variabler. `main` deployas enbart till VPS; `vercel.json` stänger
  av automatiska Vercel-byggen för `main` men lämnar Preview-grenar aktiva.
- Föreningen måste utse integritetskontakt och fatta besluten i
  [GDPR-GRIND.md](GDPR-GRIND.md); koden får inte gissa rättslig grund eller
  lagringstid. VPS-inventeringen visar dessutom att beständig, schemalagd och
  extern backup saknas; frekvens, kryptering, retention och RPO/RTO måste
  beslutas innan den kan aktiveras. Fail-closed verktyg och systemd-enheter är
  byggda i `scripts/backup-vps-databases.sh` och `deploy/backup/`: de kräver en
  separat mount och återställer varje krypterad snapshot till isolerade
  testdatabaser innan publicering. Ett fullständigt VPS-integrationstest mot
  båda drift-databaserna är grönt och lämnade inga testartefakter. Själva
  återställningsprovet mot Planlinjens
  verkliga VPS-databas är grönt för 27 tabeller.

### Säkerhetshärdning 2026-08-10

- ~~**Coach-platform saknar auth på sidor och actions**~~ – **KLART.** Root layout,
  Proxy, export-routes och samtliga 20 server actions kräver signerad BSK-identitet.
  Felaktig HMAC/JSON avvisas och testas.
- ~~**Publik liverapportering kan nås med sekventiellt match-id**~~ – **KLART.**
  Livescore är fortsatt publik, men rapporteringsdetaljer och mutationer kräver
  en unik `report_token` i den tränardelade länken eller coachbehörighet. Global
  match-rate-limit kompletterar rapportörsgränsen.
- ~~**Matchbetyg kan skriva över gruppgräns**~~ – **KLART.** Endast spelare med
  rad i `match_players` för den behörighetskontrollerade matchen behandlas.
- ~~**Publik rate-limit har samtidighetsrace**~~ – **KLART.** Atomisk
  `live_rate_limits`-upsert begränsar både matchen och rapportören; verifierat
  med parallella anrop.
- ~~**Dependency-audit**~~ – **KLART.** Båda apparna kör Next 16.3.0 och har
  `npm audit` = 0. Osäkra `xlsx` är ersatt med `read-excel-file`.

### Matchgranskning 2026-09-10

- Åtgärdat: bekräftat borttagna Svenska Lag-matcher lämnas inte längre aktiva; automatisk årskontroll för Gul och filter även i Idag.
- Kvar, historisk datakvalitet: skilj sex övergripande cupaktiviteter från individuella matcher, verifiera fem närvaroimporterade junimatchers käll-id och hantera fyra manuella poster. Skapa inte nya matcher innan kopplingarna granskats. Se `MATCH_AUDIT_2026-09-10.md`.

### Permanent åtskillnad svar/uttagning 2026-09-10

Gemensamma läsregler för matchtotaler samt gemensamt sparande för webb och mobil genomförda. Äldre trupp-/cupformulär har samma utkastmarkör och lås. Synken låser matcher före utkastkontroll och skriver aldrig ja-svar som uttagning eller närvaro. Regressioner omfattar flera matcher, källtotal noll kontra saknad total, ändrade svar och tomt utkast över synk. iOS-källkod korrigerad och simulatorbyggd; installation av den nya klientversionen är separat från webbdeploy.

### Webb och teststädning 2026-09-10

- Kerstin (testspelare 58) permanent raderad i produktion och frånvaro verifierad.
- Gulfiltrets cupgrupper inkluderas i matchlistan utan flytt eller duplicering.
- Rubriken ”Tidigare” ersätter ”Spelade” för poster som bara har passerat datum.

## Bemanningsvarning 2026-09-10

Veckans matchkort bedömer spelarbrist enbart från Svenska Lags ja-svar, aldrig
från antal markerade i laguppställningen. Befintlig gräns är nio ja; tio ja ger
alltså ingen varning även med sex eller åtta markerade. Inga registrerade
kallelsesvar ger ingen bristvarning. Uttagningen visas fortsatt separat.

## Förenklad Idag 2026-09-10

Idag visar veckans Gulmatcher en gång i en sammanhållen kolumn och behåller
matchutrymme som utfällbar fördjupning. Dubblerad nästa-match-yta, truppuppgifter
och veckosiffror är borttagna. Spelarutveckling och samtal nås under Spelare.
Väntande spelarbedömningar efter match flyttas till en utfällbar sektion på
Spelare (Gul/alla), med befintlig behörighetskontroll och länkar till utvärdering.
