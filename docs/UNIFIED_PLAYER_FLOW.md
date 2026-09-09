# Utvecklingsträd → fokus → samtal

2026-09-09. Första granskningsbara steg mot en gemensam app på bsk2014.se.
Implementerat i huvudappen, inte i den separata Development-produkten.

## Flöde

1. Öppna spelarens befintliga utvecklingsträd.
2. Uppdatera färdighetsstatus och välj högst två fokus. Extra noteringar är hopfällda och frivilliga.
3. Efter sparandet: välj ”Förbered samtal från dina val”. Samma ingång finns på spelarprofilen.
4. Underlaget återanvänder daterat fokus, kriterier och uttryckligen klarmarkerade färdigheter.
5. Efter samtalet väljer tränaren fortsatt fokus, annat nästa steg eller ingen ny överenskommelse. Fritext behövs bara vid eget nästa steg.
6. Samtalet sparas i spelarens befintliga historik. Native kan läsa samma poster via befintligt API.

## Sparande

Servern kontrollerar rättigheter, spelaråtkomst och att utvecklingsbilden tillhör spelaren.
Underlag byggs från den valda historiska bilden, inte från klientens text eller dagens änderliga status.
Ett stabilt spar-id skyddar mot dubbletter vid återförsök. Befintligt innehåll skrivs aldrig över vid id-konflikt.
Lokalt utkast återställs för samma användare och spelare i samma webbläsare i högst sju dagar (utgångna poster rensas när formuläret öppnas). Det är inte ett serverutkast eller synk mellan enheter.
Vid osäkert nätverkssvar låses innehållet tills samma försök har fått ett svar.
”Börja om med senaste trädbilden” kastar det lokala utkastet när inget sparförsök väntar.

## Avgränsning

Publicerat på bsk2014.se 2026-09-09 via PR #6, release 1bc74244. Ingen datamigrering. Trädet med 84 färdigheter bevaras.
Huvudnavigationen, gamla egna mål och historik bevaras; egna måls fritextformulär är hopfällt från början.
Native har ännu det äldre formuläret. Checkin-formulärets gamla sparmekanism har inte fått idempotensskydd i denna ändring.
Coach, övningsbibliotek, ritare och Development-data är ännu inte sammanslagna.
Coach-databasen behöver kartläggas efter kontrollerad återstart innan dess data kan migreras.
Nginx-kollisionen för /utveckling är löst: huvudappens lagträd äger nu ingången, även via /utveckling/. Sidoproduktens API och data finns kvar.
Ingen utskrift, AI eller Graphiti ingår.

## Verifiering

117 tester godkända inklusive kalenderdatum, stabilt underlag, behörighet, spelarägande, sparande utan fritext och återförsök.
TypeScript och produktionsbygge kontrolleras mot en separat lokal databas med exempelspelare.
Webbläsarprov: fokus sparat utan anteckningar → underlag → fortsätt valt fokus → en post synlig i spelarhistoriken.

Produktionskontroll med befintlig inloggning: lagträd → spelarprofil → samtalsunderlag → fokusformulär godkänt utan att skriva till riktiga spelares historik. Se MAIN_RELEASE.md.
