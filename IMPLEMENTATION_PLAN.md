# Tranarplattform - genomforandeplan

Den fristaende produkten byggs i `coach-platform/`. Den delar inte runtime, databas eller routing med BSK-appen, men ligger i samma repository tills integrationsstrategin valts.

## Milstolpar

- [x] 1. Teknisk grund: Next.js, TypeScript strict, Tailwind, Docker/Postgres, grundschema, demoorganisation, lag och spelare.
- [x] 2. Sammanhangande produktkarta: dashboard, fardigheter, spelarutveckling, ovningar, traningspass, sasongsperioder och matchobservationer med realistisk demo-data.
- [x] 3. MVP-persistens mot Postgres for spelare, ovningar och traningspass. Piloten ar server-side last till ett lag; BSK-sessionen kopplas in nar apparnas integration byggs.
- [x] 4. Objektbaserad statisk ovningsritare med planmallar, utrustning, zoner, text, tydliga rörelselinjer, undo/redo och export.
- [x] 5. Full traningsbyggare, kalender, narvaro, traningslage och genomforande.
- [ ] 6. Matchflode, regelbaserade rekommendationer och individuell utvecklingsplan.
- [ ] 7. Analys, samarbete, audit, import/export och BSK-integration.
- [ ] 8. Playwright-floden, sakerhetsgranskning och produktionshardning.

## MVP-avgransning

MVP:n testkors endast av det egna laget och totalt fyra tranare. BSK-appen ar enda identitetskalla. Tranarplattformen far inte lita pa lag-id eller anvandar-id fran URL eller klienten, utan ska verifiera BSK-sessionen server-side och lasa all data till pilotlaget. Egen autentisering, organisationshantering och generell flerlag-RBAC hor till fas 2.

## Leveransprincip

Varje milstolpe ska lamna appen korbar. Domantyper och repositories far inte importera Next.js, sa att de senare kan flyttas till ett internt paket eller monorepo.
