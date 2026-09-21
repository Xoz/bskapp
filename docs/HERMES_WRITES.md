# Hermes: avgränsad skrivåtkomst till BSK

På Ömers begäran kan den privata Hermes-profilen spara laguttagning, matchkommentar, spelarkommentar och matchresultat. Rapporternas innehåll och tider ändras inte i detta arbete.

## Flöde och begränsningar

`las_skrivunderlag` läser ett entydigt match-/spelar-ID och ger revision och kommando-ID. Användaren skriver vanliga instruktioner, inte tekniska ID:n. Fyra skrivverktyg använder denna revision. Vid otydlig match, spelare eller resultatriktning ska agenten fråga kort. Det krävs inte ett extra godkännande om användaren redan uttryckligen bett om den konkreta ändringen.

- Laguttagning använder appens gemensamma `saveMobileSelection`, behåller befintliga positioner när bara spelare väljs och ändrar inte kallelsesvar, matchplan eller faktisk närvaro. Den skickar inte kallelser eller publicering till Svenska Lag. Verktyget ersätter listan: vid ”lägg till/ta bort” måste övriga uttagna bevaras. Appens tillgängliga Gulmatcher avgör vilka uttagningar som kan sparas.
- Matchkommentar läggs till i tränarkommentaren under matchutvärderingen. Appens regel om när utvärderingen öppnar gäller (tidigare datum eller 90 minuter efter avspark). Befintlig text bevaras.
- Spelarkommentar läggs till med datum och tränarnamn i utvecklingsträdets privata anteckning (`player_skill_notes`). Inga betyg ändras och ingen spelarbedömning hittas på. Fullt anteckningsfält ger fel utan trunkering.
- Resultat anger våra mål och motståndarens mål, 0–99. Appens gemensamma resultathantering används. Resultat från Matchcenter kan inte skrivas över; matchklocka, faktiska deltagare, statistik och avslutsmarkering ändras inte av detta verktyg.

## API och åtkomst

`GET/POST /api/hermes/write` använder separat token i `/etc/bsk-hermes/write.json` på VPS. Filen innehåller `token`, `enabled`, `userId`, `sourceGroupId`; inga värden ska kopieras till Git eller anteckningar. MCP använder endast fast loopback-adress. Kontobindning, aktivt konto, tränarroll, befintlig appbehörighet och anslutet lag kontrolleras per anrop. Spelarkommentar kräver även privat spelaråtkomst. Övriga lag, fria databasfrågor och allmän administratörsåtkomst exponeras inte.

Läsning, versionskontroll, appens skrivningar och kvittot kör i samma databastransaktion via `lib/db.ts:transaction`. Delade uttagningslås och radlås används. Ändrad revision nekas i stället för att skriva över nyare data. Migration `0026-hermes-write-receipts` sparar en nyckel, innehållshash och litet kvitto; kommentarstext och spelarlistor dupliceras inte i kvittot. Identiska återförsök med samma nyckel återger ursprungligt kvitto, ändrat innehåll med samma nyckel nekas. Vid timeout ska Hermes återanvända samma nyckel och innehåll, inte påstå att det sparats.

## Verifiering

Modell-/routetester validerar indata, token, privata svar och sanerade fel. Separat lokal databas `bsk_hermes_write_20260921` testar fyra skrivningar, återförsök, samtidighet, rollback, revokerade rättigheter, andra lag, live-resultat och oförändrade kallelsesvar. Alla data där är syntetiska. Python-tester kontrollerar MCP:s transport och kommandohantering. Produktionsprov är läsande; inga riktiga laguttagningar, resultat eller kommentarer ändras som test.

Återgång: sätt `enabled=false` i VPS-fil och ta bort de fem nya verktygen ur privata profilens allowlist. Återställ föregående MCP-release vid behov. Historiska kvitton kan behållas; radera inte verksamhetsdata vid återgång. Webbrelease återställs via ordinarie releaseprocedur. Tidigare skrivskyddade DB-inloggningen är oförändrad.
