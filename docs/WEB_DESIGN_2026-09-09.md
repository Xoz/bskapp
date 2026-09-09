# Webbdesign – lugn klubbidentitet

Status 2026-09-09: implementerad lokalt i huvudappen, inte publicerad. Användaren prioriterar webb och pausar iOS.

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
