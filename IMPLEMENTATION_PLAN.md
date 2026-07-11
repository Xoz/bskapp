# Tranarplattform - genomforandeplan

Den fristaende produkten byggs i `coach-platform/`. Den delar inte runtime, databas eller routing med BSK-appen, men ligger i samma repository tills integrationsstrategin valts.

## Milstolpar

- [x] 1. Teknisk grund: Next.js, TypeScript strict, Tailwind, Docker/Postgres, grundschema, demoorganisation, lag och spelare.
- [x] 2. Sammanhangande produktkarta: dashboard, fardigheter, spelarutveckling, ovningar, traningspass, sasongsperioder och matchobservationer med realistisk demo-data.
- [ ] 3. Skrivande repository-implementation mot Postgres, autentisering och fullstandig lagbaserad RBAC.
- [ ] 4. Objektbaserad ovningsritare med sekvenser, undo/redo och export.
- [ ] 5. Full traningsbyggare, kalender, narvaro, traningslage och genomforande.
- [ ] 6. Matchflode, regelbaserade rekommendationer och individuell utvecklingsplan.
- [ ] 7. Analys, samarbete, audit, import/export och BSK-integration.
- [ ] 8. Playwright-floden, sakerhetsgranskning och produktionshardning.

## Leveransprincip

Varje milstolpe ska lamna appen korbar. Domantyper och repositories far inte importera Next.js, sa att de senare kan flyttas till ett internt paket eller monorepo.
