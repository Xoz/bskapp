# Separat Mac-arbetsflöde 0.004

Beslut 2026-10-12: Mac-appens upplevelse utvecklas separat från webben. Samma databas, session, behörigheter och befintliga skrivregler används. Inga nya verksamhetstabeller eller migrationer.

## Levererat

- Arbetsbordet är en egen SwiftUI-vy. Kommande matcher i användarens tillåtna lag, kvarvarande uppföljningar från senaste sju dagarna, fyra senast redigerade personliga träningspass och genvägar till spelarutveckling.
- Varje match får native-navigation: Förbered, Genomför, Följ upp. Stegen är fria att välja och är inga låsta godkännandesteg.
- Förbered: laguppställning, matchplan, matchutrymme/kallelser. Genomför: matchplan och ja-svarens trupp. Följ upp: matchutvärdering när befintliga lag-, tids- och behörighetsregler tillåter, samt spelarutveckling.
- Sparad matchplan, uttagna och ja-svar visas separat. Utvärderingsstatus inkluderar hanterade/överhoppade spelare enligt befintlig serverfunktion; ingen påhittad klarstatus eller datum-baserad sparstatus.
- Matchformulär används fortsatt via WebKit. Arbetsbord, matchsteg och övergångar är native. Webbens sidor ändras inte av denna release. Den dubbla webbmenyn döljs enbart i Mac när native-matchnavigeringen har laddats.

## Data och säkerhet

`GET /api/desktop/workspace` är ett begränsat läsunderlag. Kräver aktiv personalsession och view_matches, följer getMatches gruppavgränsning även för explicit match-id, begränsar berikning till 20 kommande/10 senaste samt eventuellt öppnad äldre match. Personliga träningspass läses bara för aktuell ägare med rätt behörighet. Inga matchtoken, spelarnamn, privata anteckningar eller nya skrivfunktioner i svaret. Cache-Control private/no-store och Vary Cookie.

Mac hämtar underlaget med WebKits befintliga HttpOnly-session via same-origin fetch; inga cookies kopieras till JavaScript eller nya filer. Underlaget finns endast i minnet och rensas vid utloggning. Gamla pågående svar ignoreras efter utloggning eller nytt anrop. Bryggan förmedlar navigation och en boolesk signal för matchplanens sparade sammanfattning; inget formulärinnehåll läses. Uppdatering efter navigation/sparad plan ändrar inte öppna formulär.

## Verifiering

- 245 webbtester passerade inklusive 12 nya arbetsflödes-/behörighetstester; fyra Hermes lånetester överhoppade.
- Sex native XCTest och sex bryggtester passerade. TypeScript-kontroll passerade.
- Riktig Mac-app mot separat syntetisk PostgreSQL: arbetsbord, matchdag, kommande cup, fria stegbyten, truppankare, sparad matchplan med omedelbart uppdaterad native-status, utvärderingsformulär med bedömning/överhoppning och återgång till arbetsbord där färdig uppföljning försvann.
- Riktiga spelaruppgifter ändrades inte. Extern synk och utskick kördes inte.

## Avgränsning

Detta steg separerar arbetsbordet och matchflödet. Redigeringsformulär är fortsatt gemensamma; fullständig native-omskrivning av alla formulär ingår inte. Träning och spelarutveckling har tydliga ingångar men har ännu inte egna flerstegsflöden. LiveScore är fortsatt avstängt enligt befintlig feature-flagga. Opublicerade lokala observationsfunktioner följer inte med denna serverrelease. Appen är lokalt signerad för Apple Silicon/macOS 14+, inte notariserad för allmän distribution.

## Publicering

Serverunderlaget publicerat i `cfbc75b49c2195d1f7599af7b364f7548584b061`. Körning 38210739173 passerade: 265 tester, produktionsbygge och hälsokontroller (35 DB-tester överhoppade i servermiljön). Produktions-GET utan session verifierad: 401 samt private/no-store.

Mac 0.004 byggd, lokal signatur verifierad och paket kopierat till outputs/bsk-mac/BSK-Mac.zip. Release-binären saknar debugnyckeln för lokal QA. Sista visuella produktionsprovet kunde inte köras eftersom datorn låstes; den visuella kontrollen och skrivflödena ovan genomfördes i riktig Mac-app mot syntetisk databas.
