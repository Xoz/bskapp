# Matchutvärdering och nivåunderlag

Beslut 2026-09-11: efter match visas alla registrerade deltagare i en lista, namn till vänster och ett val 1–5 till höger. Frivillig kommentar per spelare, gemensam sparning. Tom rad är ej bedömd. Detta gäller utvärdering efter match, inte snabbobservationer under pågående match.

## Skala och regler

1. Hade stora svårigheter.
2. Klarade delar, behövde mycket stöd.
3. Klarade nivån.
4. Klarade nivån med god marginal.
5. Var klart över nivån.

Poängen gäller matchens svårighetsgrad, aldrig jämförelsen med spelarens vanliga prestation. Matchnivån sparas med poängen. Text-id och Svenska Lags omvända sifferskala 1–5 normaliseras gemensamt av `lib/levels.ts`.

Nivåunderlaget räknar de senaste 180 dagarna och kräver minst fem unika matcher på en nivå samt viktat snitt minst 3. Högsta nivån med tillräckligt underlag blir visad nivå. Vid snitt minst 4 föreslås nivån närmast över att prova. Datumvikten halveras var 60:e dag. Gränserna är första implementationens justerbara regler i `RATING_RULES`, inte validerade idrottsvetenskapliga trösklar.

Flera bedömare delar en matchs vikt genom medelvärde. Oeniga/saknade nivåögonblicksbilder gör att matchen inte används för nivåförslaget. Framtida, inställda och över 180 dagar gamla matcher räknas inte. Fem femmor på Lätt etablerar Lätt och föreslår Medel; de etablerar aldrig Extra svår.

Tränaren fastställer normal-/utmaningsnivå i den befintliga profilinställningen. Den stöder nu hela skalan Extra lätt–Extra svår. Ingen automatisk uppdatering av spelarens fastställda nivå eller uttagning görs.

## Befintlig data och behörighet

Migration `0024-match-ratings` tillför `rating` och `rating_comment` till `match_player_evaluations` och breddar tillåtna tränarbedömda nivåer till 1–5. Den kräver inte observationsmigration 0023 och kan samexistera med den. Inga äldre bedömningar konverteras. Ett äldre svar står kvar vid sparande av andra spelare; att välja en poäng för den spelaren ersätter bedömarens tidigare svar. Övriga bedömares svar bevaras.

Databaskrav skiljer äldre svar, numeriska svar och överhoppade rader. Sparande återanvänder personal-/lagbehörighet, tidsspärr och inbjudningars giltighet. Endast faktisk deltagarkälla används, ingen fallback till planerad laguppställning. Resultat och sammanfattning följer befintligt flöde. Profilhistorik filtreras även efter matchgruppåtkomst. Spelarutdragets befintliga `me.*` inkluderar de nya kolumnerna och FK CASCADE hanterar radering.

Äldre webb/native-skrivare stöds för den tidigare svarstypen; någon ny nativeapp ingår inte. Vid återgång efter införda numeriska svar måste läsarna fortsatt förstå nullable äldre skalvärden. Återställ inte databasen eller radera poängen för att rulla tillbaka UI.

## Samordning med pågående arbete

Implementationen ligger isolerad i `bsk-match-ratings`, branch `codex/match-ratings`, från 063fbaca. Huvudarbetskopians observationer och den pågående profilarbetskopian har inte ändrats.

Profilförbättringen ändrar också `components/MatchEvaluationTrend.tsx`. Vid sammanfogning ska dess nya sidordning och kompaktare profil behållas; komponenten i denna branch tillför det nya nivåunderlaget och hanterar nullable äldre värden. Komponentens anrop `data={matchEvaluationTrend}` är oförändrat. Kontrollera den kombinerade sidan efter sammanfogning. Lägg till båda branchernas dokumentationsposter och båda migrationerna 0023/0024 vid integration med observationerna.

## Verifiering

`lib/matchRating.test.ts`: nivågränser, samma match/flera bedömare, normalisering, aktuell tidsperiod, datumvikt och validering. `lib/matchFollowup.test.ts`: stängning med numeriska svar. `lib/playerLevelPreferences.test.ts`: utmaning inklusive yttersta nivåerna.

`scripts/test-match-ratings.mjs` kör mot separat lokal databas `bsk_match_ratings_test` och produktionsserver på 3026 med testhemligheten `bsk-match-rating-local-test`. Skapar och städar egna exempelspelare, deltagande, matcher och bedömare. Provar 320/390/744 px, sparande/återläsning/rensning, äldre svar, nivåprofil och publik utvärdering inklusive återkallad länk. Inga produktionsuppgifter används.

Verifierat 2026-09-11: 213 tester godkända inklusive PostgreSQL (fyra befintliga opt-in-tester överhoppade), TypeScript, produktionsbygge och hela browserprovet inklusive bevarande av äldre svar. Ingen produktionspublicering. Den separata testdatabasen användes enbart för exempeldata.


## Matchutvärdering och nivåunderlag publicerat – 2026-09-11

Sammanfogad med den publicerade spelarprofilen. Kodcommit 94fca86166d6ac8ea90deac34322a74f2c93d34a, godkänd publicering https://github.com/Xoz/bskapp/actions/runs/34593106649. Huvudändring och migration 0024 publicerades i 31984b8bc477 via godkänd körning https://github.com/Xoz/bskapp/actions/runs/34593017678; backup /opt/bsk/backups/main-31984b8bc477.Ni4ItG. Slutcommit justerar matchsidans hjälptext.

216 lokala tester inklusive PostgreSQL godkända, fyra befintliga opt-in-tester överhoppade. Produktionsbygge och browserprov av sammanslagen profil, 320/390/744 px, poäng/kommentar, sparande/återläsning/rensning, äldre svar och inbjudningsbehörighet godkända. Deployens tester, bygge, migration, datagranskning och hälsokontroller passerade.

Inloggad produktion kontrollerad: Årsta-matchens tio deltagare visas samtidigt med fem poängval och korrekt matchnivå; profilens nya ordning/fokus/batteri bevarade och nivåunderlaget visas med tydligt tomt underlag innan nya poäng finns. Ingen verklig bedömning, matchplan eller spelarinställning ändrad i kontrollen. Tillfällig lokal testdatabas borttagen och testserver stoppad. Tidigare status om ej sammanfogad/ej publicerad är ersatt. Ursprungskatalogens separata observationsarbete är fortsatt orört.
