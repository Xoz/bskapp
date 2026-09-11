# Spelarprofil – förbättring 2026-09-11

Användaren godkände hela granskningens förbättringar och förtydligade att
underlagsvarningar inte behövs på varje spelarnivå.

## Innehåll och beteende

1. Kompakt spelarhuvud med namn, nummer, lag, position och matchnivå.
2. Aktuellt fokus från utvecklingsträdets senaste uttryckliga val. Om sådant
   saknas visas högst två faktiska steg i arbete under egen rubrik. Ett tomt
   träd får ingen påhittad bedömning. En huvudlänk till utvecklingsträdet.
3. Kompakt beräknat matchutrymme med befintlig grön/streckad procentstapel.
   Ingen sourceWarning på profilen. Beräkningsförklaring och kapacitetsjustering
   har separata utfällbara delar; befintliga beräkningar och sparande bevaras.
4. Senaste registrerade utvecklingsobservationer, överenskommelse och
   uppföljningsdatum från senaste samtalet. Datumet framställs inte som en
   automatiskt verifierad öppen uppgift. Fulla samtal och observationer kan öppnas.
5. Senaste matchbedömningar visar prestation relativt spelarens vanliga nivå.
   Antal över/under vanlig nivå används inte som automatisk utvecklingsdiagnos.
6. Deltagande per innevarande kalenderår; historik för tidigare år kan öppnas.
   Position/matchnivå och äldre manuella mål kommer därefter.

## Statistik

Profilens matchräknare använder samma `playerDirectoryStatsQuery` som listan.
`playerMatchHistoryQuery` använder samma matchavgränsning: alla lag, rätt år,
utan cuper/inställda matcher. Kallelsesvar hämtas från `match_roster`; uttagning
räknas inte som svar. Historiken visar faktisk matchtyp, även träningsmatcher.
Lagfördelningen går att öppna med tryck på mobil.

Träningar avser registrerad närvaro från årets början till och med igår.
Den separata 28-dagarsraden omfattar registrerade aktiviteter med deltagande
eller kallelse för spelaren. Ja/nej i en kallelse ersätter aldrig faktisk
närvaro/frånvaro. Ingen registrering visas som ej registrerad. Aktiviteter som
helt saknar koppling till spelaren kan inte räknas; perioden och underlaget
förklaras intill siffrorna. Samma årsstart används vid årsskifte medan
28-dagarsperioden kan korsa årsskiftet.

## Åtkomst och navigering

Befintlig privat spelar-layout kräver `view_private_player_data`. Profilen
kontrollerar också `view_players` och spelaråtkomst före detaljläsningar.
Redigering följer befintliga behörigheter och serverkontroller.

Listan skickar lag och aktuell sökning som kodade parametrar till profilen.
Alla spelare återgår med samma filter/sökning och ankare till rätt spelarrad.
Utvecklingsträdets returlänk behåller samma kontext. Ingen extern retur-URL tas emot.

## Avgränsning

Ingen migration, ingen ny uttagningslogik, inga ändringar av verkliga
kallelser, matchdeltaganden eller utvecklingsbedömningar. Pågående opublicerat
matchobservations-/offlinearbete i den ursprungliga arbetskatalogen är bevarat
separat; denna leverans använder den redan publicerade utvecklingskärnans
observationer. Ingen ny synkvarningsyta införs.

## Verifiering

- 213 Vitest-tester godkända, inklusive PostgreSQL-prov för gemensamt matchurval,
  historik, olika matchtyper, cuper, årsskifte och närvarons okända uppgifter.
- Produktionsbygge godkänt lokalt med separat exempeldata.
- `scripts/check-player-profile.mts`: Playwright med syntetiska spelare;
  320/390/768/1280 px, mörkt läge, tomt/ifyllt träd, antal, lagfördelning,
  återgång med filter/sökning, utvecklingsträdets returlänk, Ange position,
  sista innehållet ovanför bottennavigation, nekad privat åtkomst och fel lag.
- Skriptet kräver en lokal app och en separat databas med namn som börjar
  `bsk_profile_verify_`. Starta appen med testhemligheten som skriptet använder;
  använd aldrig riktig miljöfil. Schemat initieras av appen före testet.
- Skärmbilder och testloggar är lokala kontrollartefakter under `/tmp`.

Publiceringsstatus dokumenteras efter driftkontrollen i PROJECT_CONTEXT.md.
