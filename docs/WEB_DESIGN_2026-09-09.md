# Webbdesign – lugn klubbidentitet

Status 2026-09-09: publicerad i huvudappen (se releaseprotokoll nedan). Användaren prioriterar webb och pausar iOS.

## Ändrat

- Varmvit grund, vita kort, mörkgrönt för handlingar och klubbens originalmärke. Gult finns i märket; spelarnummer och lagetiketter har neutrala ytor.
- Ljust som standard, valbart mörkt/system via verktygsmenyn. Tidig temainit och skydd när lokal lagring blockeras.
- Gemensamma färgvariabler i app/calm.css efter befintlig CSS. Större tryckytor, fokusmarkering, läsbar formulärtext och minskad rörelse.
- Responsiv toppnavigation på större skärmar, bottennavigation på mobil. Verktygsdialog visar endast tillåtna befintliga länkar.
- Idag prioriterar nästa match inom den befintliga veckokällan och spelarutveckling. Veckosiffror och matchutrymme är kvar i hopfällbara sektioner.
- Startsida, inloggning och webbappens märkesresurser uppdaterade.

## Bevarat och avgränsat

Utvecklingsträd, högst två fokus, samtal, sparflöden och datamodell är bevarade. Ingen iOS-kod, migration eller produktionsdata ändrad. Coach och Development är inte fullt sammanslagna genom denna designändring. Befintliga specialvyer ärver det gemensamma temat; ingen fullständig ombyggnad av alla deras kontroller ingår.

Originalmärke: https://cdn06.svenskalag.se/img/clubmarks/1762.png?9 (200 × 216, jubileumsversion). UI-grönt utgår från klubbwebbens #006D3F; ingen officiell gul HEX påstås.

## Verifiering

- 122 tester i 21 filer passerar, inklusive temaval, systemläge och blockerad lokal lagring.
- Produktionsbygge inklusive TypeScript passerar mot separat lokal exempeldatabas.
- Visuell kontroll i Chrome: Idag på desktop och 820 px; spelarprofil, matchöversikt och utvecklingsträd på 390 px; utvecklingsredigering på 320 px. Ljust/mörkt läge och temats beständighet vid sidladdning kontrollerade.
- Befintliga tester täcker verksamhetsregler; denna session har inte gjort en full manuell genomgång av alla roller och matchhändelser.
- Lokal förhandsvisning: http://localhost:3015/idag . Endast exempeldata. Separat byggkatalog via BSK_BUILD_DIR gör att annan lokal utvecklingsserver kan fortsätta.

## Underlag

Godkänd bild och kompletterande specifikationer ligger i ../outputs/bsk-designpaket-v1 räknat från huvudrepots rot. Konceptbilderna är riktning, inte en exakt bild av alla implementerade funktioner. Koden och denna status anger vad som faktiskt är infört.


## Webbdesign publicerad 2026-09-09

Efter användarens instruktion publicerades designen på https://bsk2014.se, commit `9eacc854d18f3e0e93b6a2e65dd6d11b41c5dfc7`. GitHub Actions https://github.com/Xoz/bskapp/actions/runs/34344433886 passerade tester, produktionsbygge, datagranskning och hälsokontroller. Aktiv release `/opt/bsk/releases/9eacc854d18f.aedBpv`; backup `/opt/bsk/backups/main-9eacc854d18f.yN4Yzv`.

Inloggad Idag-vy och originalmärke verifierade visuellt i produktion. 67 spelare, 144 matcher och 0 samtal efter publicering, samma antal som före ändringen. Inga verksamhetsuppgifter skrivna under kontrollen. iOS fortsatt pausad.
