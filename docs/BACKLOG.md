# Backlog

Samlade öppna punkter. Detaljerade specar bor i egna filer – den här listan är en
överblick över vad som väntar och var det är dokumenterat.

## Aktuellt efter publiceringarna 2026-09-09

Denna sammanställning har företräde framför äldre pilotstatus nedan. Målet är en
samlad huvudapp på bsk2014.se. Observation är inte ett obligatoriskt förstasteg.

Publicerat: spelarträd → fokus → samtalsunderlag/historik, ny webbdesign och
träningsbyggare med originalritaren samt 15 mallövningar. Se
`UNIFIED_PLAYER_FLOW.md`, `TRAINING_BUILDER.md` och `MAIN_RELEASE.md`.

Kvar för en fullt samlad lagapp, i rekommenderad arbetsordning:

1. **Inventera kvarvarande Coach-/Development-data.** Återläs Coach-databasen
   separat, skilj verklig data från demo, mappa original-id:n och provimportera
   användbara övningar, ritningar, pass och historik utan dubbletter.
2. **Gör träningen gemensam för laget.** Nuvarande pass är personliga. Kvar:
   lagkoppling, behörig delning mellan tränare, återanvändbara egna övningar,
   koppling till befintlig träningsaktivitet och ett genomförandeläge.
3. **Förenkla den sammanhållna vägen.** Samla match/uttagning/efterarbete under
   samma match. Gör nästa steg tydligt och undvik att separata gamla mål och
   trädfokus uppfattas som dubbla krav. Navigationens föreslagna målbild
   Idag–Spelare–Matcher–Träning är ännu inte helt genomförd.
4. **Verifiera vardagsanvändningen.** Ett verkligt spelar-/samtalsflöde och ett
   helt lagpass på mobil/iPad-webb, med återöppning, nätavbrott, flera tränare
   och korrekta rättigheter. Checkin-formulärets återförsök och serverutkast
   för samtal återstår; dagens utkast är lokala i webbläsaren.
5. **Avveckla sidoprodukterna sist.** När data och motsvarande funktioner är
   verifierade: stäng gamla skrivvägar, omdirigera gamla länkar och stäng
   överflödiga tjänster. Kontrollera sammanhängande utdrag/radering/backup.

Kända datavarningar från senaste release: 9 aktiva spelare utan primär grupp
samt en skillnad mellan målhändelser och matchresultat. Kräver separat kontroll;
inte automatiska korrigeringar. Vercel Preview saknar ännu en egen databas;
aktuell backupdrift ska kontrolleras mot faktiska tjänster, inte äldre påståenden.

iOS är pausad enligt senaste PROJECT_CONTEXT. Utskrift behövs inte.
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
