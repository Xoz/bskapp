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

## Slutlig visuell produktionskontroll 2026-10-12

Efter upplåsning kontrollerades arbetsbordets tomläge, historisk match, native-stegen, utvärderingsformuläret, träning, utveckling och återgång med kortkommando mot bsk2014.se. Mörkt tema, sidomeny och dubbleringsfri matchnavigation kontrollerades visuellt. Inga formulär fylldes i eller sparades och inga riktiga spelaruppgifter ändrades.

En klientmiss upptäcktes för äldre matcher som hämtas först efter öppning: startsteget kunde bli Förbered i stället för Följ upp. Rättat i 0.005, med regressionsprov för fördröjda data och manuellt stegval. Sju native-tester passerade. Samma server/databas och webbgränssnitt används; klienträttningen kräver ingen serverändring.

Slutprovet av 0.005 mot produktionen passerade: historisk match öppnas automatiskt på Följ upp, ett manuellt valt Genomför behålls vid omladdning, sessionen finns kvar efter omstart och appen lämnades på Arbetsbord. Paketet i outputs/bsk-mac/BSK-Mac.zip är uppdaterat. Rättningen är lokal i Mac-klienten; ingen serverrelease eller verksamhetsskrivning gjordes i denna kontroll.

## Native träning och utveckling 0.006 · 2026-10-12

Mac har egna SwiftUI-översikter för träning och spelarutveckling. Träning går från personliga sparade pass till en genomförandevy med instruktioner, ordning och minuter per övning, sedan vidare till utvecklingsuppföljning. Ritningar och redigering öppnas i befintlig redigerare. Övningsval är tillfälligt och registrerar inte genomförande eller närvaro.

Utveckling har spelarsökning och vägar till utvecklingsbild, avstämning, samtal och profilhistorik. Senaste avstämning, samtal och senaste samtalets uppföljningsdatum visas endast med privatläsbehörighet. Formulären och deras sparlogik återanvänds. Native återgång visas över formulären. Återgång till översikten hämtar den sparade informationen igen.

GET `/api/desktop/practice` är ett separat läs-API med befintlig session, roll- och gruppbehörighet. Träningspass filtreras på ägare. Inga nya tabeller eller skrivvägar; inga ändringar i webbens sidor eller komponenter. API returnerar inte kontaktuppgifter, privata spelartexter eller delningstokens. Träningslistan visar de 100 senast uppdaterade personliga passen.

Verifierat i isolerad lokal databas med syntetiska uppgifter: träningslista, instruktioner, sökning och länk till avstämning. Automatiska prov täcker obehörig åtkomst, ägar- och gruppavgränsning, privata datum samt enbart SELECT-frågor.

## Produktionskontroll 0.006 · 2026-10-12

På uttryckligt godkännande sammanfogades PR #13 som `1135fd9d102c48ec55831fc25ab1f676dd46c0dc`. Publicering `38214400925` godkänd: 270 tester passerade, 35 överhoppades; bygge, datamodellkontroll och hälsokontroller passerade. GET `/api/desktop/practice` ger 401 utan session och `private, no-store`.

Releaseappen 0.006 kontrollerad mot bsk2014.se: kvarvarande session efter omstart, native träningsöversikt/tomläge, öppnat nytt träningsformulär, native utvecklingslista, spelarsökning, utvecklingsträd, avstämningsformulär, samtalsförberedelse och native återgång. Inga formulär fylldes eller sparades och inga riktiga spelaruppgifter ändrades. Kontot saknade sparade produktionspass; övningsvis genomförande är därför verifierat med syntetiska data, inte med produktionspass. Appen lämnad på Arbetsbord.

## Native-redigerare 0.007 · 2026-10-12

Träningsredigeraren, övningsbanken, ritningsytan, utvecklingsavstämningen och spelarsamtalet är SwiftUI/AppKit. Macens navigation fångar redigeringsadresserna före WebKit; formulären laddas inte som webbinnehåll. Övriga befintliga webbsidor och komponenter är oförändrade.

Träningsstudion har passnamn/datum, övningsordning/minuter, bank med native ritningar, tom övning, duplicering, borttagning/återställning, instruktioner och ritfilsimport. Native ritningsverktyg: spelare, boll, kon, mål, passning, löpning, drivning och text; flytt, kurvhandtag, etikett, färg, storlek, duplicering, borttagning, ångra/gör om. Pass kan importeras/exporteras som JSON. Samma version 1-dokument och revisionskontroll som webben; alla befintliga bankritningar roundtrip-testade.

Avstämning visar de befintliga 84 färdigheterna, kriterier/råd, fyra statusar, högst två fokus, tränare/datum samt frivilliga styrkor/fokus/mående. En snapshot och aktuellt läge sparas atomiskt i befintliga tabeller. Versionsfingeravtryck nekar inaktuellt underlag. UUID för sparförsöket ger idempotent återförsök även efter förlorat svar. Samtal använder samma underlagsbyggare och idempotenta skrivkommando som webben, med utfall, notering, spelarens ord, överenskommelse och valfritt uppföljningsdatum.

GET/POST `/api/desktop/editor` använder befintlig HttpOnly-session; POST kräver samma origin och JSON. Ägarfilter för pass; personalroll, redigeringsbehörighet, privatläsbehörighet och gruppåtkomst för spelarformulär. Inga nya tabeller. `desktopTransaction` är ett additivt transaktions-API; befintliga databasfunktioner är oförändrade.

Utkast hålls lokalt i Mac-appens lagring per autentiserad användare och redigeringsadress. Återställning tillåts inom sju dagar och först efter behörig serverläsning. Sparade eller uttryckligen lämnade utkast tas bort. Oklart sparresultat fryser exakt innehåll/UUID för återförsök. Navigering, utloggning, fönsterstängning och avslut skyddar osparade ändringar. Träningskonflikt kan behållas som nytt pass eller ersättas av senast sparad version efter bekräftelse.

Verifierat med enbart syntetiska data: native träningsskapande/sparning och återläsning, bank/ritning, objektflytt/ångra, avstämningsstatus/fokusgräns/sparning, samtalsunderlag/utfall/sparning och osparat-dialog. Separata API-integrationstester provar samtidiga sparförsök, identiska återförsök, ändrat återförsök, gammalt underlag och träningsrevision. Inga riktiga spelaruppgifter ändrade. Produktionspublicering av 0.007 återstår.

Slutkontroll: isolerad produktionsgren 278 servertester godkända, 35 separata tester överhoppade; typkontroll, produktionsbygge med webpack och tom lokal QA-databas, 14 native-tester och sex bryggtester godkända. Standardbyggarens symlänkbegränsning undveks med webpack. Träningsduplicering/omordning samt Stanna vid fönsterstängning visuellt verifierade. HTTP 5xx behåller samma låsta sparförsök precis som ett förlorat nätverkssvar. Release 0.007 byggd och lokalt signerad; ingen produktionsskrivning.
