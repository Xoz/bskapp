# BSK F2014 – tränar- och utvecklingsplattform

Webbapp för Bollstanäs SK F2014 med spelarutveckling, träningsplanering,
matcher, live-rapportering, laguttagning, statistik och administration.
Generativa AI-funktioner är pausade; regelbaserad produktlogik är kvar.

## Funktioner

- Daterade utvecklingsavstämningar, färdighetsträd och läsvy för spelaren.
- Matcher, cuper, laguttagning, matchobservationer och matchspecifik form.
- Publik Livescore samt capability-skyddad liverapportering.
- Grupp- och spelaravgränsade roller för admin, huvudtränare, tränare,
  lagledare, föräldrar och spelare.
- Versionsmärkt spelarutdrag och behörighetsstyrd permanent radering.
- Separat Planlinjen-app för övningar, träningspass, säsongsplanering,
  genomförande, matcher och analys.

## Lokal utveckling

Huvudappen använder en separat lokal Postgres-databas; använd aldrig
produktionsdatabasen för utveckling.

```bash
npm ci
# Sätt lokal DATABASE_URL och övriga värden enligt .env.example
npm run dev
```

`scripts/seed-dev.mjs` skapar lokal testdata och vägrar köra mot en icke-lokal
databas. Planlinjen har egna instruktioner i `coach-platform/README.md`.

## Teknik och verifiering

- Next.js 16, React 19, TypeScript strict och Tailwind CSS.
- Postgres via `postgres` (postgres.js).
- Google OAuth och signerad HTTP-only-session; utvecklingsinloggning finns bara
  utanför produktion.
- Vitest, ett 36-stegs liveprotokoll och Planlinjens Playwright-flöden.

```bash
npx tsc --noEmit
npm test
npm run build
npm audit
```

## Produktion och staging

`main` deployas av GitHub Actions till VPS:en. Huvudappen kör på port 3001 och
Planlinjen på port 3101 bakom den signerade sessionsbryggan på
`https://bsk2014.se/coach/`. Workflowen bygger båda apparna, migrerar
Planlinjens databas och hälsotestar tjänsterna och auth-grinden.

Vercel är reserverat för Preview/staging. Automatiska Vercel-deployer från
`main` är avstängda i `vercel.json`; se `docs/STAGING.md` för den separata
stagingdatabas som måste skapas innan Preview kan användas.

## Integritet

Apparna behandlar personuppgifter om barn. Tekniska auth-, scope-, utdrags-,
raderings- och återställningsgrindar finns, men Planlinjen får endast använda
syntetisk pilotdata tills föreningen har protokollfört ändamål, rättslig grund,
lagringstid, skadefält, biträden och integritetskontakt. Samtycke ska inte antas
vara en universell rättslig grund. Se `docs/GDPR-GRIND.md` och
`docs/DRIFT-OCH-BITRADEN.md`.

Kodens orienteringskarta och aktuellt projektläge finns i `docs/CODEMAP.md` och
`docs/PROJECT_CONTEXT.md`.
