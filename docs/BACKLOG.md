# Backlog

Samlade öppna punkter. Detaljerade specar bor i egna filer – den här listan är en
överblick över vad som väntar och var det är dokumenterat.

## Öppet

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
  [DRIFT-OCH-BITRADEN.md](DRIFT-OCH-BITRADEN.md), besluta skadefältet och bygg
  gallring först efter fastställd retentiontabell.

- ~~**Matchbetyg – Fas 2**~~ – **KLART.** Formlistan visas på Översikt och
  cupkorten visar bästa form i cupen. Nivåförslag och regelbaserade förslag från
  matchstatistik är inkopplade. Skrivflödet är dessutom avgränsat till faktiska
  `match_players`. Se [SPEC-matchbetyg.md](SPEC-matchbetyg.md).

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
- Föreningen måste utse integritetskontakt och fatta besluten i
  [GDPR-GRIND.md](GDPR-GRIND.md); koden får inte gissa rättslig grund eller
  lagringstid.

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
