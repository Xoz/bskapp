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
  `scripts/test-live.sh` steg O (33/33). (`components/LiveTracker.tsx`,
  `lib/live.ts`, `lib/db.ts`)

### Övriga granskningsfynd

- **[Hög] Intervjuer är inte bundna till spelar-ID** – en spelarsession
  kontrolleras vid API-anropet, men namn och position tas från requesten och
  intervjuer kopplas senare via fritextnamn. Spara `player_id` och hämta
  identiteten server-side. (`app/api/ai/intervju/`, `lib/queries.ts`)

- **Testskydd** – lägg till automatiska tester för behörighet, gruppscope,
  cupgrupper, parallell liverapportering och offline-replay. Projektet saknar
  även separata test- och lintscript.

- **GDPR** – appen lagrar personuppgifter om **minderåriga** (spelare 11–12 år):
  namn, bedömningar/betyg, AI-intervjusvar, närvaro m.m. Behöver gås igenom:
  rättslig grund/samtycke (vårdnadshavare), lagringstid & gallring, rätt till
  radering/utdrag, vilka personuppgifter som skickas till AI (Anthropic) och om
  det kräver särskild information. Frågan: vad behöver vi göra för att vara
  GDPR-kompatibla, och vad är minsta rimliga steg? *(Spec saknas – behöver skrivas.)*

- **Matchbetyg – Fas 2** (integrationer): kvar är **form-topplista i Översikt** och
  **bästa form-kort i cup**. Klart sedan tidigare: nivåförslag från matchform och
  invävning av form i AI-förslaget. Se [SPEC-matchbetyg.md](SPEC-matchbetyg.md).

- **Staging** – koden klar, manuella engångssteg kvar (Vercel-env, Google-redirect).
  OBS: DB:n är migrerad från Turso till **Supabase/Postgres** – stegen i STAGING.md
  behöver uppdateras till en Supabase-stagingdatabas. Se [STAGING.md](STAGING.md).
