# Tranarplattform - genomforandeplan

Den fristaende produkten byggs i `coach-platform/`. Den delar inte runtime, databas eller routing med BSK-appen, men ligger i samma repository tills integrationsstrategin valts.

## Milstolpar

- [x] 1. Teknisk grund: Next.js, TypeScript strict, Tailwind, Docker/Postgres, grundschema, demoorganisation, lag och spelare.
- [x] 2. Sammanhangande produktkarta: dashboard, fardigheter, spelarutveckling, ovningar, traningspass, sasongsperioder och matchobservationer med realistisk demo-data.
- [x] 3. MVP-persistens mot Postgres for spelare, ovningar och traningspass. Piloten ar server-side last till ett lag; BSK-sessionen kopplas in nar apparnas integration byggs.
- [x] 4. Objektbaserad statisk ovningsritare med planmallar, utrustning, zoner, text, tydliga rörelselinjer, undo/redo och export.
- [x] 5. Full traningsbyggare, kalender, narvaro, traningslage och genomforande.
- [x] 6. Matchflode, regelbaserade rekommendationer och individuell utvecklingsplan.
- [x] 7. Analys, samarbete, audit, export och BSK-sessionsbrygga. Återställningsimport och generell flerlagssynk hör till fas 2.
- [ ] 8. Playwright-floden, sakerhetsgranskning och produktionshardning.
  - [x] Signerad BSK-identitet i Proxy, root layout, export och samtliga server actions.
  - [x] HMAC-, action-auth- och Playwright-regressionstester.
  - [x] Versionssäker migrationsrunner, spelarutdrag/radering och verifierat återställningsprov (27 tabeller).
  - [ ] Driftsätt den byggda `/api/auth/coach-bridge`-routen, sätt `BSK_SESSION_BRIDGE_SECRET` i båda processerna och aktivera `deploy/nginx-coach.conf.example` i VPS-proxyn.
  - [ ] Föreningen genomför återstående juridiska GDPR-beslut före riktiga barnuppgifter.

## MVP-avgransning

MVP:n testkors endast av det egna laget och totalt fyra tranare. BSK-appen ar enda identitetskalla. Tranarplattformen far inte lita pa lag-id eller anvandar-id fran URL eller klienten, utan ska verifiera BSK-sessionen server-side och lasa all data till pilotlaget. Egen autentisering, organisationshantering och generell flerlag-RBAC hor till fas 2.

## Leveransprincip

Varje milstolpe ska lamna appen korbar. Domantyper och repositories far inte importera Next.js, sa att de senare kan flyttas till ett internt paket eller monorepo.
