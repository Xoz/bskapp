# Träningsbyggare med den befintliga Övningsritaren

2026-09-09. Användaren valde tekniken i klvr.se/ritare och förtydligade att den redan är byggd i detta projekt. Källan är projektets `outputs/ovningsritare/index.html` och `bank.js`.

## Implementerat i huvudappen

Träning → Mina träningspass → Nytt träningspass. Välj en av 15 färdiga övningar, anpassa ritningen, ändra minuter och ordning, spara passet och öppna igen. Färdiga instruktioner följer med; egen text är valfri. Ett borttaget övningsblock kan ångras under pågående redigering.

Den ursprungliga SVG-renderaren är extraherad till `lib/training/drawing.js`. Samma koordinater (1000 × 700), figurer, kvadratiska Bézier-pilar och linjestilar används. Pointer Events, drag, handtag för pilböj, ångra/gör om, färg, storlek, text och duplicering är anpassade till React. Renderaren körs direkt i träningsbyggaren; ingen iframe eller separat app. Unika SVG-id:n förhindrar kollision mellan förhandsvisningar och ritplan. Ritfiler version 1 kan öppnas utan koordinatkonvertering.

`bank.json` är en oförändrad datasnapshot av de 15 egenbyggda mallarna i `outputs/ovningsritare/bank.js`. Mallarna kopieras till passet; en redigering påverkar inte originalbanken eller andra pass. Inga externa ritbibliotek, konton eller AI-tjänster har införts. Ingen utskriftsfunktion ingår.

## Sparande och gränser

- Samma BSK-inloggning. Första versionen har personliga pass: endast skaparen kan läsa och ändra sina pass. Befintlig rättighet `manage_evaluations` krävs också. Lagdelning är ett senare steg; detta är inte en ny gemensam lagkalender.
- `training_plans`: id, created_by, dokument som JSONB, revision, updated_at. Migration 0021 är enbart additiv.
- Servervalidering av datum, storlek, objekttyper, färger, id:n och numeriska koordinater. SVG-text escapas. Högst 30 block, 500 objekt per ritning och 1 MB per sparat dokument.
- Atomisk uppdatering kräver samma ägare och förväntad revision. Identiskt återförsök efter tappat svar godtas; samtidiga ändringar skrivs inte över. Vid konflikt kan utkastet sparas som ett nytt pass.
- Utkast sparas lokalt per användare/pass i webbläsaren. Ingen synkning av osparade utkast mellan enheter. Ett osäkert sparförsök låser innehållet tills det får svar.
- Postgres-parametrar använder text→JSONB-cast så att dokumentet lagras som objekt, inte dubbelt JSON-kodad sträng.

## Verifiering och publicering

130 tester godkända, inklusive de 15 originalmallarna, validering, säker SVG-text, behörighet och revisionskonflikt. TypeScript och produktionsbygge provas mot den separata lokala testdatabasen. Webbläsarprov: mall → flytta spelare → ångra/gör om → två block → ändra ordning/minuter → spara → återöppna. Sparad ritposition kontrolleras också.

Publicerat 2026-09-09 via PR #7, produktionscommit `3095f1d70b617b9283efd464c4dacdf6925fc1eb`. Migration och återgång har provats på en återläst produktionskopia (se nedan). Coach-data och klvr.se/ritare är orörda. Föregående appversion avvisar migrationsmarkör 0021; vid en återgång ska endast markören återtas under kontrollerat stopp, medan tabellen och sparade pass behålls. Deployskriptet hanterar detta om 0021 applicerades av det misslyckade försöket.

Coachs gamla övningsdata/normaliserade koordinater är ännu inte migrerade. Konvertera först efter inventering; blanda inte modellerna genom en direkt JSON-kopiering. Native och teamdelning ingår inte i första versionen.


## Releaseförberedelse 2026-09-09

Produktionsdump återläst till separat databas på VPS. Faktisk migration körd via appens databaslager, kontrollpass skrivet, endast markör 0021 återtagen, föregående appversion startad mot kopian och därefter migrationen körd igen. 67 spelare och kontrollpasset bevarade genom hela provet. Kontrolldatabasen borttagen; privat provbackup i `/opt/bsk/training-check.55FJF2`.

Deployskriptets felhantering startar nu före bygget. Om 0021 inte fanns före försöket återtas endast dess markör vid misslyckad publicering; tabellen och pass behålls. Redan publicerad migration återtas inte av senare releasers felhantering.


## Produktionskontroll

- Godkänd GitHub-körning: https://github.com/Xoz/bskapp/actions/runs/34352997532 . 130 tester, produktionsbygge och datamodellsgranskning godkända på VPS.
- Release `/opt/bsk/releases/3095f1d70b61.OiBCpV`, länkad via `/opt/bsk/current`. Backup `/opt/bsk/backups/main-3095f1d70b61.NwNPan`.
- Befintlig inloggad Chrome-session verifierade `/traning`, den nya navigationslänken och `/traning/nytt` med alla 15 övningar. Inga testpass skapades på användarens produktionskonto.
- Efter release: 67 spelare, 144 matcher, 0 träningspass och en 0021-markör. BSK, Coach och Development-API fortsatt aktiva.
- Befintliga datavarningar om nio spelare utan primär grupp och en resultatskillnad oförändrade. De hör inte till träningsbyggarens release.
